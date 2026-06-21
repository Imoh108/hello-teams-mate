import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertPlatformAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("role", "platform_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: platform admin only");
}

const QuestionSchema = z.object({
  questions: z
    .array(
      z.object({
        prompt: z.string().min(5).max(500),
        choices: z.array(z.string().min(1).max(200)).length(4),
        correct_index: z.number().int().min(0).max(3),
        explanation: z.string().max(500).optional(),
      })
    )
    .min(1)
    .max(20),
});

const CategorisationSchema = z.object({
  assignments: z.array(
    z.object({
      index: z.number().int().min(0),
      category_slug: z.string().min(1).max(80),
    })
  ),
});

type GeneratedQ = z.infer<typeof QuestionSchema>["questions"][number];

async function loadCategories(admin: any) {
  const { data, error } = await admin
    .from("question_categories")
    .select("id, slug, name, description");
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; slug: string; name: string; description: string | null }[];
}

/**
 * Ask the AI to assign each generated question to one of the existing categories
 * by slug. Falls back to `general` for anything it doesn't recognise.
 */
async function categoriseQuestions(
  gateway: ReturnType<typeof import("./ai-gateway.server").createLovableAiGatewayProvider>,
  questions: GeneratedQ[],
  categories: { id: string; slug: string; name: string; description: string | null }[]
): Promise<(string | null)[]> {
  const slugToId = new Map(categories.map((c) => [c.slug, c.id]));
  const fallback = slugToId.get("general-knowledge") ?? null;
  if (questions.length === 0) return [];

  try {
    const { generateText, Output } = await import("ai");
    const catalogue = categories
      .map((c) => `- ${c.slug}: ${c.name}${c.description ? ` — ${c.description}` : ""}`)
      .join("\n");
    const numbered = questions
      .map((q, i) => `${i}. ${q.prompt}`)
      .join("\n");

    const { output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      output: Output.object({ schema: CategorisationSchema }),
      system:
        "You assign each quiz question to ONE category from the provided list. Respond with the category's slug exactly as given. If nothing fits, use 'general'.",
      prompt: `Categories:\n${catalogue}\n\nQuestions:\n${numbered}\n\nReturn an assignment for every question by index.`,
    });

    const map = new Map<number, string>();
    for (const a of output.assignments) map.set(a.index, a.category_slug);
    return questions.map((_, i) => slugToId.get(map.get(i) ?? "") ?? fallback);
  } catch {
    return questions.map(() => fallback);
  }
}

/** Kick off an AI generation job from a free-form topic + optional pasted text. */
export const generatePlatformQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        topic: z.string().min(2).max(200),
        source: z.string().min(2).max(120).default("manual"),
        count: z.number().int().min(1).max(15).default(5),
        difficulty: z.number().int().min(1).max(5).default(2),
        context: z.string().max(8000).optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(apiKey);

    const { data: job, error: jobErr } = await supabaseAdmin
      .from("ai_generation_jobs")
      .insert({
        source: data.source,
        topic: data.topic,
        status: "generating",
        prompt: data.context ?? null,
        created_by: context.userId,
      })
      .select()
      .single();
    if (jobErr) throw new Error(jobErr.message);

    try {
      const { generateText, Output } = await import("ai");
      const { output } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        output: Output.object({ schema: QuestionSchema }),
        system:
          "You write high-quality multiple-choice quiz questions for a corporate training platform. Each question has exactly 4 plausible choices, one correct. Avoid trick wording. Keep prompts concise and self-contained.",
        prompt: `Topic: ${data.topic}\nDifficulty: ${data.difficulty}/5\nGenerate exactly ${data.count} questions.${
          data.context ? `\n\nReference material:\n${data.context}` : ""
        }`,
      });
      const questions = output.questions.slice(0, data.count);
      const categories = await loadCategories(supabaseAdmin);
      const categoryIds = await categoriseQuestions(gateway, questions, categories);
      const items = questions.map((q, i) => ({
        job_id: job.id,
        topic: data.topic,
        source: data.source,
        difficulty: data.difficulty,
        prompt: q.prompt,
        choices: q.choices,
        correct_index: q.correct_index,
        explanation: q.explanation ?? null,
        category_id: categoryIds[i] ?? null,
      }));
      const { error: insErr } = await supabaseAdmin.from("ai_generated_items").insert(items);
      if (insErr) throw insErr;
      await supabaseAdmin
        .from("ai_generation_jobs")
        .update({ status: "review", generated_count: items.length })
        .eq("id", job.id);
      return { jobId: job.id, generated: items.length };
    } catch (e: any) {
      await supabaseAdmin
        .from("ai_generation_jobs")
        .update({ status: "failed", error_message: String(e?.message ?? e).slice(0, 500) })
        .eq("id", job.id);
      throw new Error("Generation failed: " + (e?.message ?? e));
    }
  });

/** Shared: scrape one source, generate, categorise, insert pending items. */
async function runGenerationForSource(opts: {
  src: any;
  count: number;
  difficulty: number;
  userId: string;
  supabaseAdmin: any;
  gateway: ReturnType<typeof import("./ai-gateway.server").createLovableAiGatewayProvider>;
}) {
  const { src, count, difficulty, userId, supabaseAdmin, gateway } = opts;
  const { scrapeUrlMarkdown } = await import("./firecrawl.server");
  const topic = src.topic || src.name;

  const { data: job, error: jobErr } = await supabaseAdmin
    .from("ai_generation_jobs")
    .insert({
      source: src.name,
      topic,
      status: "generating",
      prompt: `Scraped from ${src.url}`,
      created_by: userId,
    })
    .select()
    .single();
  if (jobErr) throw new Error(jobErr.message);

  try {
    const sourceText = await scrapeUrlMarkdown(src.url);
    const { generateText, Output } = await import("ai");
    const { output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      output: Output.object({ schema: QuestionSchema }),
      system:
        "You write high-quality multiple-choice quiz questions strictly grounded in the provided source text. Each question has exactly 4 plausible choices, one correct. Avoid trick wording.",
      prompt: `Source: ${src.name} (${src.url})\nTopic: ${topic}\nDifficulty: ${difficulty}/5\nGenerate exactly ${count} multiple-choice questions grounded in the text below.\n\n---\n${sourceText}\n---`,
    });
    const questions = output.questions.slice(0, count);

    // Dedupe: drop questions whose normalized prompt already exists in pending,
    // approved (ai_generated_items) or promoted bank_questions for this source.
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
    const [{ data: existingAi }, { data: existingBank }] = await Promise.all([
      supabaseAdmin
        .from("ai_generated_items")
        .select("prompt")
        .eq("source", src.name)
        .limit(2000),
      supabaseAdmin
        .from("bank_questions")
        .select("prompt")
        .limit(5000),
    ]);
    const seen = new Set<string>([
      ...((existingAi ?? []).map((r: any) => norm(r.prompt))),
      ...((existingBank ?? []).map((r: any) => norm(r.prompt))),
    ]);
    const uniqueQuestions: typeof questions = [];
    const uniqueIndices: number[] = [];
    questions.forEach((q, i) => {
      const key = norm(q.prompt);
      if (seen.has(key)) return;
      seen.add(key);
      uniqueQuestions.push(q);
      uniqueIndices.push(i);
    });
    const duplicatesSkipped = questions.length - uniqueQuestions.length;

    if (uniqueQuestions.length === 0) {
      await supabaseAdmin
        .from("ai_generation_jobs")
        .update({
          status: "review",
          generated_count: 0,
          error_message: `Skipped ${duplicatesSkipped} duplicate(s); nothing new to review.`,
        })
        .eq("id", job.id);
      return { jobId: job.id, generated: 0, duplicatesSkipped };
    }

    const categories = await loadCategories(supabaseAdmin);
    const categoryIds = await categoriseQuestions(gateway, uniqueQuestions, categories);
    const items = uniqueQuestions.map((q, i) => ({
      job_id: job.id,
      topic,
      source: src.name,
      difficulty,
      prompt: q.prompt,
      choices: q.choices,
      correct_index: q.correct_index,
      explanation: q.explanation ?? null,
      category_id: categoryIds[i] ?? null,
    }));
    const { error: insErr } = await supabaseAdmin.from("ai_generated_items").insert(items);
    if (insErr) throw insErr;
    await supabaseAdmin
      .from("ai_generation_jobs")
      .update({ status: "review", generated_count: items.length })
      .eq("id", job.id);
    return { jobId: job.id, generated: items.length, duplicatesSkipped };

  } catch (e: any) {
    await supabaseAdmin
      .from("ai_generation_jobs")
      .update({ status: "failed", error_message: String(e?.message ?? e).slice(0, 500) })
      .eq("id", job.id);
    throw e;
  }
}

/** Scrape a saved content source with Firecrawl, generate + categorise questions. */
export const generateFromSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        sourceId: z.string().uuid(),
        count: z.number().int().min(1).max(15).default(5),
        difficulty: z.number().int().min(1).max(5).default(2),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");

    const { data: src, error: srcErr } = await supabaseAdmin
      .from("content_sources")
      .select("*")
      .eq("id", data.sourceId)
      .single();
    if (srcErr) throw new Error(srcErr.message);
    if (!src) throw new Error("Source not found");

    const gateway = createLovableAiGatewayProvider(apiKey);
    try {
      return await runGenerationForSource({
        src,
        count: data.count,
        difficulty: data.difficulty,
        userId: context.userId,
        supabaseAdmin,
        gateway,
      });
    } catch (e: any) {
      throw new Error("Generation failed: " + (e?.message ?? e));
    }
  });

/** Bulk: scrape every verified source and queue generated questions for review. */
export const generateFromAllVerifiedSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        countPerSource: z.number().int().min(1).max(15).default(5),
        difficulty: z.number().int().min(1).max(5).default(2),
        limit: z.number().int().min(1).max(50).default(20),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(apiKey);

    const { data: sources, error } = await supabaseAdmin
      .from("content_sources")
      .select("*")
      .eq("verified", true)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    if (!sources || sources.length === 0) {
      return { processed: 0, succeeded: 0, failed: 0, totalGenerated: 0, totalDuplicatesSkipped: 0, results: [] };
    }

    const results: { source: string; ok: boolean; generated?: number; duplicatesSkipped?: number; error?: string }[] = [];
    let succeeded = 0;
    let failed = 0;
    let totalGenerated = 0;
    let totalDuplicatesSkipped = 0;
    for (const src of sources) {
      try {
        const r = await runGenerationForSource({
          src,
          count: data.countPerSource,
          difficulty: data.difficulty,
          userId: context.userId,
          supabaseAdmin,
          gateway,
        });
        succeeded++;
        totalGenerated += r.generated;
        totalDuplicatesSkipped += r.duplicatesSkipped ?? 0;
        results.push({ source: src.name, ok: true, generated: r.generated, duplicatesSkipped: r.duplicatesSkipped });
      } catch (e: any) {
        failed++;
        results.push({ source: src.name, ok: false, error: String(e?.message ?? e).slice(0, 200) });
      }
    }
    return { processed: sources.length, succeeded, failed, totalGenerated, totalDuplicatesSkipped, results };
  });


export const listPendingItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("ai_generated_items")
      .select("*, question_categories(name, slug)")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listRecentJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("ai_generation_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return await loadCategories(supabaseAdmin);
  });

export const setItemCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ itemId: z.string().uuid(), categoryId: z.string().uuid().nullable() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("ai_generated_items")
      .update({ category_id: data.categoryId })
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reviewItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        itemId: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        reason: z.string().max(300).optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: item, error } = await supabaseAdmin
      .from("ai_generated_items")
      .update({
        status: data.decision,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        reject_reason: data.decision === "rejected" ? data.reason ?? null : null,
      })
      .eq("id", data.itemId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (item?.job_id) {
      const field = data.decision === "approved" ? "approved_count" : "rejected_count";
      const { data: job } = await supabaseAdmin
        .from("ai_generation_jobs")
        .select("approved_count, rejected_count, generated_count")
        .eq("id", item.job_id)
        .single();
      if (job) {
        const next = { ...job, [field]: (job as any)[field] + 1 };
        const allDone = next.approved_count + next.rejected_count >= next.generated_count;
        await supabaseAdmin
          .from("ai_generation_jobs")
          .update({
            approved_count: next.approved_count,
            rejected_count: next.rejected_count,
            status: allDone ? "approved" : "review",
          })
          .eq("id", item.job_id);
      }
    }
    return { ok: true };
  });

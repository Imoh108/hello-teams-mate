import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertPlatformAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "platform_admin",
  });
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

/** Kick off an AI generation job. Items land in ai_generated_items as 'pending'. */
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
      const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
      const gateway = createLovableAiGatewayProvider(apiKey);
      const { output } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        output: Output.object({ schema: QuestionSchema }),
        system:
          "You write high-quality multiple-choice quiz questions for a corporate training platform. Each question has exactly 4 plausible choices, one correct. Avoid trick wording. Keep prompts concise and self-contained.",
        prompt: `Topic: ${data.topic}\nDifficulty: ${data.difficulty}/5\nGenerate exactly ${data.count} questions.${
          data.context ? `\n\nReference material:\n${data.context}` : ""
        }`,
      });
      const items = output.questions.slice(0, data.count).map((q) => ({
        job_id: job.id,
        topic: data.topic,
        source: data.source,
        difficulty: data.difficulty,
        prompt: q.prompt,
        choices: q.choices,
        correct_index: q.correct_index,
        explanation: q.explanation ?? null,
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

export const listPendingItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("ai_generated_items")
      .select("*")
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
    // bump job counters
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

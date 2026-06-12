import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText, Output } from "ai";

const GenerateInput = z.object({
  documentId: z.string().uuid(),
  bankId: z.string().uuid(),
  count: z.number().int().min(1).max(20).default(5),
  difficulty: z.number().int().min(1).max(5).default(2),
});

const QuestionsSchema = z.object({
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

export const generateQuestionsFromDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenerateInput.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");

    // 1. Load document and verify the user can access it via RLS
    const { data: doc, error: docErr } = await context.supabase
      .from("training_documents")
      .select("id, org_id, file_name, extracted_text")
      .eq("id", data.documentId)
      .single();
    if (docErr) throw new Error(docErr.message);
    if (!doc?.extracted_text || doc.extracted_text.trim().length < 50) {
      throw new Error("Document has no extracted text. Add or paste text first.");
    }

    // 2. Verify bank belongs to the same org and user is admin (RLS will also enforce on insert)
    const { data: bank, error: bankErr } = await context.supabase
      .from("question_banks")
      .select("id, org_id")
      .eq("id", data.bankId)
      .single();
    if (bankErr) throw new Error(bankErr.message);
    if (bank.org_id !== doc.org_id) throw new Error("Bank and document belong to different organizations");

    // 3. Find current max position so generated questions append cleanly
    const { data: posRow } = await context.supabase
      .from("bank_questions")
      .select("position")
      .eq("bank_id", data.bankId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const basePos = (posRow?.position ?? -1) + 1;

    // 4. Call Lovable AI Gateway
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(apiKey);

    // Trim source text to keep prompts manageable
    const source = doc.extracted_text.slice(0, 12_000);

    let aiOutput: z.infer<typeof QuestionsSchema>;
    try {
      const { output } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        output: Output.object({ schema: QuestionsSchema }),
        system:
          "You are a corporate training quiz writer. Generate multiple-choice questions strictly grounded in the provided source text. Each question has exactly 4 plausible choices with one correct answer. Avoid trick questions. Keep prompts concise.",
        prompt: `Source document: ${doc.file_name}\n\nGenerate exactly ${data.count} multiple-choice questions (difficulty ${data.difficulty} of 5) from the text below. Return JSON matching the schema.\n\n---\n${source}\n---`,
      });
      aiOutput = output;
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      if (msg.includes("429")) throw new Error("AI rate limit reached — please try again shortly.");
      if (msg.includes("402")) throw new Error("AI credits exhausted — add credits in Workspace settings.");
      throw new Error("AI generation failed: " + msg);
    }

    // 5. Insert generated questions
    const rows = aiOutput.questions.slice(0, data.count).map((q, i) => ({
      bank_id: data.bankId,
      prompt: q.prompt,
      choices: q.choices,
      correct_index: q.correct_index,
      explanation: q.explanation ?? null,
      difficulty: data.difficulty,
      position: basePos + i,
    }));

    const { data: inserted, error: insErr } = await context.supabase
      .from("bank_questions")
      .insert(rows)
      .select();
    if (insErr) throw new Error(insErr.message);

    return { created: inserted?.length ?? 0 };
  });

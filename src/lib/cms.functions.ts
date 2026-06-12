import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireTier } from "@/lib/tier-guard.server";
import { z } from "zod";

// ---------- Question Banks ----------

export const listBanks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("question_banks")
      .select("*")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getBank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ bankId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: bank, error } = await context.supabase
      .from("question_banks").select("*").eq("id", data.bankId).single();
    if (error) throw new Error(error.message);
    const [{ data: questions }, { data: tags }] = await Promise.all([
      context.supabase.from("bank_questions").select("*").eq("bank_id", data.bankId).order("position"),
      context.supabase.from("bank_tags").select("*").eq("bank_id", data.bankId).order("tag"),
    ]);
    return { bank, questions: questions ?? [], tags: tags ?? [] };
  });

export const createBank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    orgId: z.string().uuid(),
    name: z.string().min(1).max(120),
    description: z.string().max(500).optional(),
    departmentId: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireTier(context.supabase, data.orgId, "premium");
    const { data: row, error } = await context.supabase
      .from("question_banks")
      .insert({
        org_id: data.orgId,
        name: data.name,
        description: data.description ?? null,
        department_id: data.departmentId ?? null,
        created_by: context.userId,
      })
      .select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteBank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ bankId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("question_banks").delete().eq("id", data.bankId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Bank Questions ----------

const QuestionSchema = z.object({
  id: z.string().uuid().optional(),
  bankId: z.string().uuid(),
  prompt: z.string().min(1).max(500),
  choices: z.array(z.string().min(1).max(200)).length(4),
  correct_index: z.number().int().min(0).max(3),
  explanation: z.string().max(500).optional(),
  difficulty: z.number().int().min(1).max(5).default(1),
  position: z.number().int().min(0).default(0),
});

export const saveBankQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => QuestionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const payload = {
      bank_id: data.bankId,
      prompt: data.prompt,
      choices: data.choices,
      correct_index: data.correct_index,
      explanation: data.explanation ?? null,
      difficulty: data.difficulty,
      position: data.position,
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("bank_questions").update(payload).eq("id", data.id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("bank_questions").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteBankQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("bank_questions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Tags ----------

export const addBankTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    bankId: z.string().uuid(),
    tag: z.string().min(1).max(40).regex(/^[a-zA-Z0-9_\- ]+$/),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("bank_tags").insert({ bank_id: data.bankId, tag: data.tag.toLowerCase() })
      .select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const removeBankTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("bank_tags").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Training Documents ----------

export const listDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("training_documents").select("*")
      .eq("org_id", data.orgId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const registerDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    orgId: z.string().uuid(),
    bankId: z.string().uuid().nullable().optional(),
    departmentId: z.string().uuid().nullable().optional(),
    file_name: z.string().min(1).max(255),
    file_path: z.string().min(1).max(500),
    mime_type: z.string().min(1).max(120),
    size_bytes: z.number().int().min(0),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireTier(context.supabase, data.orgId, "premium");
    const { data: row, error } = await context.supabase
      .from("training_documents")
      .insert({
        org_id: data.orgId,
        bank_id: data.bankId ?? null,
        department_id: data.departmentId ?? null,
        uploaded_by: context.userId,
        file_name: data.file_name,
        file_path: data.file_path,
        mime_type: data.mime_type,
        size_bytes: data.size_bytes,
        status: "uploaded",
      }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const setDocumentExtractedText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    text: z.string().max(500_000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("training_documents")
      .update({ extracted_text: data.text, status: "ready", error: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: doc } = await context.supabase
      .from("training_documents").select("file_path").eq("id", data.id).single();
    if (doc?.file_path) {
      await context.supabase.storage.from("training-documents").remove([doc.file_path]);
    }
    const { error } = await context.supabase.from("training_documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Create quiz from bank ----------

export const createQuizFromBank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    bankId: z.string().uuid(),
    title: z.string().min(1).max(120).optional(),
    limit: z.number().int().min(1).max(50).default(20),
    time_limit_s: z.number().int().min(5).max(120).default(20),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: bank, error: e0 } = await supabase
      .from("question_banks").select("*").eq("id", data.bankId).single();
    if (e0 || !bank) throw new Error("Bank not found");
    await supabase.from("user_roles").upsert(
      { user_id: userId, role: "manager" },
      { onConflict: "user_id,role" }
    );
    const { data: quiz, error: e1 } = await supabase
      .from("quizzes")
      .insert({
        owner_id: userId,
        title: data.title ?? bank.name,
        description: bank.description,
        topic_pack: "custom",
        org_id: bank.org_id,
        department_id: bank.department_id,
      })
      .select().single();
    if (e1 || !quiz) throw new Error(e1?.message ?? "Failed to create quiz");
    const { data: bqs } = await supabase
      .from("bank_questions").select("*").eq("bank_id", data.bankId)
      .order("position").limit(data.limit);
    if (bqs && bqs.length) {
      const rows = bqs.map((q: any, i: number) => ({
        quiz_id: quiz.id,
        position: i + 1,
        prompt: q.prompt,
        options: Array.isArray(q.choices) ? q.choices : [],
        correct_index: q.correct_index,
        time_limit_s: data.time_limit_s,
      }));
      const { error: e2 } = await supabase.from("questions").insert(rows);
      if (e2) throw new Error(e2.message);
    }
    return quiz;
  });

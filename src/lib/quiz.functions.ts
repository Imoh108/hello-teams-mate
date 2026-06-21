import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { computePoints, generateJoinCode } from "@/lib/scoring";

// --- Roles ---
export const becomeManager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role: "manager" }, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Quizzes ---
const CreateQuizSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  topic_pack: z.enum(["company_trivia", "industry_knowledge", "general_culture", "custom"]),
});

export const createQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateQuizSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // ensure manager role
    await supabase.from("user_roles").upsert({ user_id: userId, role: "manager" }, { onConflict: "user_id,role" });
    const { data: row, error } = await supabase
      .from("quizzes")
      .insert({ owner_id: userId, title: data.title, description: data.description ?? null, topic_pack: data.topic_pack })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// --- Create quiz from seeded categories ---
const CreateFromCategoriesSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  category_ids: z.array(z.string().uuid()).min(1).max(20),
  rounds: z.number().int().min(1).max(10),
  questions_per_round: z.number().int().min(1).max(30),
  time_limit_s: z.number().int().min(5).max(120).default(20),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("mixed"),
});

export const createQuizFromCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateFromCategoriesSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const total = data.rounds * data.questions_per_round;

    await supabase.from("user_roles").upsert(
      { user_id: userId, role: "manager" },
      { onConflict: "user_id,role" }
    );

    // Pull approved items from the chosen categories, filter by difficulty bucket
    let query = supabase
      .from("ai_generated_items")
      .select("prompt,choices,correct_index,difficulty,category_id")
      .eq("status", "approved")
      .in("category_id", data.category_ids);
    if (data.difficulty === "easy") query = query.lte("difficulty", 2);
    else if (data.difficulty === "medium") query = query.eq("difficulty", 3);
    else if (data.difficulty === "hard") query = query.gte("difficulty", 4);

    const { data: pool, error: poolErr } = await query.limit(2000);
    if (poolErr) throw new Error(poolErr.message);
    if (!pool || pool.length < total) {
      throw new Error(`Not enough questions in the chosen pool. Requested ${total}, available ${pool?.length ?? 0}.`);
    }

    // Fisher–Yates shuffle, take total
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const picked = shuffled.slice(0, total);

    // Create the quiz
    const { data: quiz, error: qErr } = await supabase
      .from("quizzes")
      .insert({
        owner_id: userId,
        title: data.title,
        description: data.description ?? null,
        topic_pack: "general_culture",
      })
      .select()
      .single();
    if (qErr || !quiz) throw new Error(qErr?.message ?? "Failed to create quiz");

    // Distribute round-robin across rounds so categories interleave
    const rows = picked.map((q, idx) => {
      const round = (idx % data.rounds) + 1;
      return {
        quiz_id: quiz.id,
        position: idx + 1,
        round,
        prompt: q.prompt,
        options: Array.isArray(q.choices) ? q.choices : [],
        correct_index: q.correct_index,
        time_limit_s: data.time_limit_s,
      };
    });
    const { error: insErr } = await supabase.from("questions").insert(rows);
    if (insErr) throw new Error(insErr.message);
    return quiz;
  });

// --- Categories listing with approved-question counts (for builder UI) ---
export const listCategoryPool = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: cats, error } = await supabase
      .from("question_categories")
      .select("id,name,slug,description")
      .order("name");
    if (error) throw new Error(error.message);
    const { data: items } = await supabase
      .from("ai_generated_items")
      .select("category_id")
      .eq("status", "approved");
    const counts = new Map<string, number>();
    (items ?? []).forEach((r: any) => {
      counts.set(r.category_id, (counts.get(r.category_id) ?? 0) + 1);
    });
    return (cats ?? []).map((c) => ({ ...c, approved_count: counts.get(c.id) ?? 0 }));
  });

const CloneQuizSchema = z.object({ source_quiz_id: z.string().uuid() });
export const cloneQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CloneQuizSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("user_roles").upsert({ user_id: userId, role: "manager" }, { onConflict: "user_id,role" });
    const { data: src, error: e1 } = await supabase.from("quizzes").select("*").eq("id", data.source_quiz_id).single();
    if (e1 || !src) throw new Error("Source quiz not found");
    const { data: newQuiz, error: e2 } = await supabase
      .from("quizzes")
      .insert({ owner_id: userId, title: `${src.title} (copy)`, description: src.description, topic_pack: src.topic_pack })
      .select()
      .single();
    if (e2 || !newQuiz) throw new Error(e2?.message ?? "clone failed");
    const { data: qs } = await supabase.from("questions").select("*").eq("quiz_id", src.id).order("position");
    if (qs && qs.length) {
      const rows = qs.map((q) => ({
        quiz_id: newQuiz.id,
        position: q.position,
        prompt: q.prompt,
        options: q.options,
        correct_index: q.correct_index,
        time_limit_s: q.time_limit_s,
      }));
      const { error: e3 } = await supabase.from("questions").insert(rows);
      if (e3) throw new Error(e3.message);
    }
    return newQuiz;
  });

const SaveQuestionSchema = z.object({
  id: z.string().uuid().optional(),
  quiz_id: z.string().uuid(),
  position: z.number().int().min(1),
  prompt: z.string().min(1).max(500),
  options: z.array(z.string().min(1).max(200)).length(4),
  correct_index: z.number().int().min(0).max(3),
  time_limit_s: z.number().int().min(5).max(120),
  round: z.number().int().min(1).max(10).default(1),
});
export const saveQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveQuestionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.id) {
      const { error } = await supabase.from("questions").update({
        prompt: data.prompt, options: data.options, correct_index: data.correct_index,
        time_limit_s: data.time_limit_s, position: data.position, round: data.round,
      }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase.from("questions").insert({
      quiz_id: data.quiz_id, position: data.position, prompt: data.prompt,
      options: data.options, correct_index: data.correct_index, time_limit_s: data.time_limit_s,
      round: data.round,
    }).select("id").single();
    if (error || !row) throw new Error(error?.message ?? "insert failed");
    return { id: row.id };
  });

export const deleteQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("questions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Sessions ---
export const createSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ quiz_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Verify quiz has questions
    const { data: qs, error: qErr } = await supabase.from("questions").select("id").eq("quiz_id", data.quiz_id).limit(1);
    if (qErr) throw new Error(qErr.message);
    if (!qs || qs.length === 0) throw new Error("Quiz has no questions yet.");
    // Generate unique join_code
    for (let i = 0; i < 5; i++) {
      const code = generateJoinCode();
      const { data: row, error } = await supabase
        .from("sessions")
        .insert({ quiz_id: data.quiz_id, host_id: userId, join_code: code })
        .select()
        .single();
      if (!error && row) return row;
      if (error && !error.message.toLowerCase().includes("duplicate")) throw new Error(error.message);
    }
    throw new Error("Could not allocate join code, please retry.");
  });

export const joinSessionByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ code: z.string().min(4).max(10) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const code = data.code.trim().toUpperCase();
    const { data: session, error } = await supabase.from("sessions").select("*").eq("join_code", code).maybeSingle();
    if (error) throw new Error(error.message);
    if (!session) throw new Error("Session not found.");
    if (session.status === "ended") throw new Error("This session has ended.");
    const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", userId).single();
    const { error: jErr } = await supabase.from("session_players").upsert(
      { session_id: session.id, user_id: userId, display_name: profile?.display_name ?? "Player" },
      { onConflict: "session_id,user_id" }
    );
    if (jErr) throw new Error(jErr.message);
    return { session_id: session.id };
  });

const StartQuestionSchema = z.object({
  session_id: z.string().uuid(),
  question_id: z.string().uuid(),
  time_limit_override_s: z.number().int().min(5).max(120).nullable().optional(),
});
export const startQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StartQuestionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: session } = await supabase.from("sessions").select("host_id").eq("id", data.session_id).single();
    if (!session || session.host_id !== userId) throw new Error("Not host");
    const { error } = await supabase.from("sessions").update({
      status: "active",
      current_question_id: data.question_id,
      question_started_at: new Date().toISOString(),
      time_limit_override_s: data.time_limit_override_s ?? null,
    }).eq("id", data.session_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revealAnswers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ session_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: session } = await supabase.from("sessions").select("host_id").eq("id", data.session_id).single();
    if (!session || session.host_id !== userId) throw new Error("Not host");
    const { error } = await supabase.from("sessions").update({ status: "reveal" }).eq("id", data.session_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const endSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ session_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: session } = await supabase.from("sessions").select("host_id").eq("id", data.session_id).single();
    if (!session || session.host_id !== userId) throw new Error("Not host");
    const { error } = await supabase.from("sessions").update({
      status: "ended", ended_at: new Date().toISOString(), current_question_id: null,
    }).eq("id", data.session_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const SubmitAnswerSchema = z.object({
  session_id: z.string().uuid(),
  question_id: z.string().uuid(),
  selected_index: z.number().int().min(0).max(3).nullable(),
  flagged: z.boolean().optional(),
});
export const submitAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SubmitAnswerSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Verify player is in session
    const { data: sp } = await supabase.from("session_players")
      .select("id").eq("session_id", data.session_id).eq("user_id", userId).maybeSingle();
    if (!sp) throw new Error("Not in session");
    // Server-anchored timing
    const { data: session } = await supabase.from("sessions")
      .select("current_question_id,question_started_at,status,time_limit_override_s").eq("id", data.session_id).single();
    if (!session || session.current_question_id !== data.question_id || session.status !== "active") {
      throw new Error("Question not active");
    }
    const { data: q } = await supabase.from("questions")
      .select("correct_index,time_limit_s").eq("id", data.question_id).single();
    if (!q) throw new Error("Question missing");
    const startedAt = new Date(session.question_started_at!).getTime();
    const elapsedMs = Date.now() - startedAt;
    const limitS = session.time_limit_override_s ?? q.time_limit_s;
    if (elapsedMs > limitS * 1000 + 500) {
      // time up — record null answer
    }
    const isCorrect = data.selected_index !== null && data.selected_index === q.correct_index;
    const points = computePoints(isCorrect, elapsedMs, limitS);
    const { error } = await supabase.from("answers").upsert({
      session_id: data.session_id,
      question_id: data.question_id,
      user_id: userId,
      selected_index: data.selected_index,
      time_taken_ms: Math.max(0, elapsedMs),
      is_correct: isCorrect,
      points,
      flagged: !!data.flagged,
    }, { onConflict: "session_id,question_id,user_id" });
    if (error) throw new Error(error.message);
    if (points > 0) {
      const { data: sessionRow } = await supabase.from("sessions")
        .select("org_id").eq("id", data.session_id).single();
      await supabase.rpc("award_points", {
        _user: userId,
        _org: (sessionRow?.org_id ?? null) as string,
        _source: "quiz_answer",
        _delta: points,
        _ref: data.question_id,
      });
    }
    if (data.flagged) {
      await supabase.from("session_players").update({ flagged_count: (await flaggedCount(supabase, data.session_id, userId)) })
        .eq("session_id", data.session_id).eq("user_id", userId);
    }
    return { ok: true, points, isCorrect };
  });

async function flaggedCount(supabase: any, sessionId: string, userId: string) {
  const { count } = await supabase.from("answers")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId).eq("user_id", userId).eq("flagged", true);
  return count ?? 0;
}

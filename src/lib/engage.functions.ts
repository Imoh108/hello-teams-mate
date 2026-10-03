import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText, Output } from "ai";

// ---------- Quick-play templates ----------
export const QUICK_TEMPLATES = [
  { key: "icebreaker", title: "Friday Icebreaker", desc: "Light, fun mix to warm up the team.", cats: ["General Knowledge", "Movies & TV", "Music", "Food & Drink"], rounds: 2, qpr: 5, difficulty: "easy" as const, time: 20 },
  { key: "brainiac", title: "Brainiac Challenge", desc: "Harder questions on history & science.", cats: ["History", "Science & Nature", "Geography"], rounds: 3, qpr: 5, difficulty: "hard" as const, time: 25 },
  { key: "popculture", title: "Pop Culture Sprint", desc: "Fast rounds on films, TV, music & sport.", cats: ["Movies & TV", "Music", "Sports"], rounds: 2, qpr: 6, difficulty: "mixed" as const, time: 15 },
  { key: "world", title: "Around the World", desc: "Geography, food and culture.", cats: ["Geography", "Food & Drink", "History"], rounds: 3, qpr: 4, difficulty: "mixed" as const, time: 20 },
];

export const launchQuickTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const tpl = QUICK_TEMPLATES.find((t) => t.key === data.key);
    if (!tpl) throw new Error("Unknown template");
    const { supabase, userId } = context;
    await supabase.from("user_roles").upsert({ user_id: userId, role: "manager" }, { onConflict: "user_id,role" });

    const { data: cats } = await supabase.from("question_categories").select("id,name").in("name", tpl.cats);
    const ids = (cats ?? []).map((c) => c.id);
    if (!ids.length) throw new Error("Template categories not found");

    let q = supabase.from("ai_generated_items").select("prompt,choices,correct_index").eq("status", "approved").in("category_id", ids);
    if (tpl.difficulty === "easy") q = q.lte("difficulty", 2);
    else if (tpl.difficulty === "hard") q = q.gte("difficulty", 4);
    let { data: pool } = await q.limit(1500);
    const total = tpl.rounds * tpl.qpr;
    if (!pool || pool.length < total) {
      // fall back to any difficulty
      const r = await supabase.from("ai_generated_items").select("prompt,choices,correct_index").eq("status", "approved").in("category_id", ids).limit(1500);
      pool = r.data ?? [];
    }
    if (pool.length < total) throw new Error("Not enough questions for this template yet");
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, total);

    const { data: quiz, error } = await supabase
      .from("quizzes")
      .insert({ owner_id: userId, title: tpl.title, description: tpl.desc, topic_pack: "general_culture" })
      .select()
      .single();
    if (error || !quiz) throw new Error(error?.message ?? "Failed to create quiz");
    const rows = shuffled.map((it, i) => ({
      quiz_id: quiz.id, position: i + 1, round: Math.floor(i / tpl.qpr) + 1,
      prompt: it.prompt, options: Array.isArray(it.choices) ? it.choices : [], correct_index: it.correct_index, time_limit_s: tpl.time,
    }));
    const { error: insErr } = await supabase.from("questions").insert(rows);
    if (insErr) throw new Error(insErr.message);
    return { quiz_id: quiz.id };
  });

// ---------- Topic -> AI questions ----------
const AiSchema = z.object({
  questions: z.array(z.object({
    prompt: z.string().min(5).max(300),
    choices: z.array(z.string().min(1).max(120)).length(4),
    correct_index: z.number().int().min(0).max(3),
  })).min(1).max(20),
});

export const generateQuizFromTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    topic: z.string().trim().min(2).max(120),
    count: z.number().int().min(3).max(20),
    difficulty: z.enum(["easy", "medium", "hard"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(apiKey);
    let out: z.infer<typeof AiSchema>;
    try {
      const { output } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        output: Output.object({ schema: AiSchema }),
        system: "You write accurate, fun multiple-choice trivia. Exactly 4 plausible choices, one correct. No trick questions. Vary the position of the correct answer.",
        prompt: `Write exactly ${data.count} ${data.difficulty} trivia questions about: ${data.topic}`,
      });
      out = output;
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      if (msg.includes("429")) throw new Error("AI is busy — try again in a moment.");
      if (msg.includes("402")) throw new Error("AI credits exhausted — add credits in Workspace settings.");
      throw new Error("Question generation failed");
    }
    const { supabase, userId } = context;
    await supabase.from("user_roles").upsert({ user_id: userId, role: "manager" }, { onConflict: "user_id,role" });
    const { data: quiz, error } = await supabase
      .from("quizzes")
      .insert({ owner_id: userId, title: data.topic.slice(0, 120), description: `AI-generated · ${data.difficulty}`, topic_pack: "custom" })
      .select().single();
    if (error || !quiz) throw new Error(error?.message ?? "Failed to create quiz");
    const rows = out.questions.map((q, i) => ({
      quiz_id: quiz.id, position: i + 1, round: 1, prompt: q.prompt, options: q.choices, correct_index: q.correct_index, time_limit_s: 20,
    }));
    const { error: insErr } = await supabase.from("questions").insert(rows);
    if (insErr) throw new Error(insErr.message);
    return { quiz_id: quiz.id, count: rows.length };
  });

// ---------- Daily question + streaks ----------
function todayUtc() { return new Date().toISOString().slice(0, 10); }

async function pickDaily(supabase: any) {
  const { count } = await supabase.from("ai_generated_items").select("id", { count: "exact", head: true }).eq("status", "approved");
  const n = count ?? 0;
  if (!n) return null;
  const day = Math.floor(Date.now() / 86_400_000);
  const offset = (day * 7919) % n;
  const { data } = await supabase.from("ai_generated_items").select("id,prompt,choices,correct_index").eq("status", "approved").order("id").range(offset, offset).maybeSingle();
  return data;
}

export const getDailyChallenge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const q = await pickDaily(context.supabase);
    const { data: s } = await context.supabase.from("daily_streaks").select("*").eq("user_id", context.userId).maybeSingle();
    const playedToday = s?.last_played === todayUtc();
    return {
      question: q ? { id: q.id, prompt: q.prompt, choices: q.choices as string[], correct_index: playedToday ? q.correct_index : null } : null,
      streak: { current: s?.current_streak ?? 0, best: s?.best_streak ?? 0, playedToday },
    };
  });

export const answerDaily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ index: z.number().int().min(0).max(3) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = await pickDaily(context.supabase);
    if (!q) throw new Error("No daily question available");
    const today = todayUtc();
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const { data: s } = await supabaseAdmin.from("daily_streaks").select("*").eq("user_id", context.userId).maybeSingle();
    if (s?.last_played === today) throw new Error("You already played today — come back tomorrow!");
    const correct = data.index === q.correct_index;
    const current = s?.last_played === yesterday ? (s.current_streak ?? 0) + 1 : 1;
    const best = Math.max(current, s?.best_streak ?? 0);
    await supabaseAdmin.from("daily_streaks").upsert({
      user_id: context.userId, current_streak: current, best_streak: best, last_played: today,
      total_correct: (s?.total_correct ?? 0) + (correct ? 1 : 0), updated_at: new Date().toISOString(),
    });
    return { correct, correct_index: q.correct_index, current, best };
  });

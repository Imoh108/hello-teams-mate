import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateJoinCode } from "@/lib/scoring";

async function createSoloSession(supabase: any, userId: string, quizId: string) {
  for (let i = 0; i < 5; i++) {
    const code = generateJoinCode();
    const { data: row, error } = await supabase
      .from("sessions")
      .insert({ quiz_id: quizId, host_id: userId, join_code: code, status: "active" })
      .select("id")
      .single();
    if (!error && row) {
      const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", userId).single();
      await supabase.from("session_players").upsert(
        { session_id: row.id, user_id: userId, display_name: profile?.display_name ?? "Player" },
        { onConflict: "session_id,user_id" }
      );
      return row.id as string;
    }
    if (error && !error.message.toLowerCase().includes("duplicate")) throw new Error(error.message);
  }
  throw new Error("Could not allocate session, please retry.");
}

async function sessionTotal(supabase: any, sessionId: string | null, userId: string) {
  if (!sessionId) return null;
  const { data } = await supabase
    .from("answers")
    .select("points")
    .eq("session_id", sessionId)
    .eq("user_id", userId);
  return (data ?? []).reduce((s: number, a: any) => s + (a.points ?? 0), 0);
}

export const createDuel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ quiz_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: qs } = await supabase.from("questions").select("id").eq("quiz_id", data.quiz_id).limit(1);
    if (!qs || qs.length === 0) throw new Error("Quiz has no questions yet.");
    const sessionId = await createSoloSession(supabase, userId, data.quiz_id);
    const { data: row, error } = await supabase
      .from("quiz_challenges")
      .insert({ quiz_id: data.quiz_id, challenger_id: userId, challenger_session_id: sessionId })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Failed to create duel");
    return { challenge_id: row.id, session_id: sessionId };
  });

export const acceptDuel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ challenge_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ch, error } = await supabase
      .from("quiz_challenges")
      .select("*")
      .eq("id", data.challenge_id)
      .single();
    if (error || !ch) throw new Error("Duel not found");
    if (ch.challenger_id === userId) throw new Error("You can't accept your own duel");
    if (ch.expires_at && new Date(ch.expires_at) < new Date()) throw new Error("This duel has expired");
    if (ch.opponent_id && ch.opponent_id !== userId) throw new Error("This duel already has an opponent");
    if (ch.opponent_id === userId && ch.opponent_session_id) {
      return { challenge_id: ch.id, session_id: ch.opponent_session_id };
    }
    const sessionId = await createSoloSession(supabase, userId, ch.quiz_id);
    const { error: uErr } = await supabase
      .from("quiz_challenges")
      .update({ opponent_id: userId, opponent_session_id: sessionId, status: "active" })
      .eq("id", ch.id);
    if (uErr) throw new Error(uErr.message);
    return { challenge_id: ch.id, session_id: sessionId };
  });

export const getDuel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ challenge_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: ch, error } = await supabase
      .from("quiz_challenges")
      .select("*")
      .eq("id", data.challenge_id)
      .single();
    if (error || !ch) throw new Error("Duel not found");
    const { data: quiz } = await supabase.from("quizzes").select("title").eq("id", ch.quiz_id).single();
    const { count } = await supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("quiz_id", ch.quiz_id);
    const ids = [ch.challenger_id, ch.opponent_id].filter(Boolean) as string[];
    const { data: profiles } = await supabase.from("profiles").select("id,display_name").in("id", ids);
    const nameOf = (id: string | null) =>
      id ? (profiles ?? []).find((p: any) => p.id === id)?.display_name ?? "Player" : null;

    const challengerScore = await sessionTotal(supabase, ch.challenger_session_id, ch.challenger_id);
    const opponentScore = ch.opponent_id
      ? await sessionTotal(supabase, ch.opponent_session_id, ch.opponent_id)
      : null;

    // A side has "finished" when its session is ended
    const sessionIds = [ch.challenger_session_id, ch.opponent_session_id].filter(Boolean) as string[];
    const { data: sessions } = await supabase.from("sessions").select("id,status").in("id", sessionIds);
    const statusOf = (sid: string | null) => (sessions ?? []).find((s: any) => s.id === sid)?.status ?? null;
    const challengerDone = statusOf(ch.challenger_session_id) === "ended";
    const opponentDone = ch.opponent_session_id ? statusOf(ch.opponent_session_id) === "ended" : false;

    let winnerId: string | null = ch.winner_id;
    if (challengerDone && opponentDone && !winnerId) {
      winnerId = (challengerScore ?? 0) >= (opponentScore ?? 0) ? ch.challenger_id : ch.opponent_id;
      await supabase
        .from("quiz_challenges")
        .update({ status: "completed", winner_id: winnerId })
        .eq("id", ch.id);
    }

    return {
      id: ch.id,
      quiz_id: ch.quiz_id,
      quiz_title: quiz?.title ?? "Quiz",
      question_count: count ?? 0,
      status: winnerId ? "completed" : ch.status,
      challenger_id: ch.challenger_id,
      challenger_name: nameOf(ch.challenger_id),
      challenger_session_id: ch.challenger_session_id,
      challenger_score: challengerDone ? challengerScore : null,
      challenger_done: challengerDone,
      opponent_id: ch.opponent_id,
      opponent_name: nameOf(ch.opponent_id),
      opponent_session_id: ch.opponent_session_id,
      opponent_score: opponentDone ? opponentScore : null,
      opponent_done: opponentDone,
      winner_id: winnerId,
      expires_at: ch.expires_at,
    };
  });

export const listDuels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("quiz_challenges")
      .select("id,quiz_id,challenger_id,opponent_id,status,winner_id,created_at")
      .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const quizIds = Array.from(new Set((data ?? []).map((d: any) => d.quiz_id)));
    const userIds = Array.from(
      new Set((data ?? []).flatMap((d: any) => [d.challenger_id, d.opponent_id]).filter(Boolean))
    );
    const [{ data: quizzes }, { data: profiles }] = await Promise.all([
      quizIds.length ? supabase.from("quizzes").select("id,title").in("id", quizIds) : { data: [] },
      userIds.length ? supabase.from("profiles").select("id,display_name").in("id", userIds) : { data: [] },
    ]);
    const quizTitle = (id: string) => (quizzes ?? []).find((q: any) => q.id === id)?.title ?? "Quiz";
    const nameOf = (id: string | null) =>
      id ? (profiles ?? []).find((p: any) => p.id === id)?.display_name ?? "Player" : null;
    return (data ?? []).map((d: any) => ({
      ...d,
      quiz_title: quizTitle(d.quiz_id),
      challenger_name: nameOf(d.challenger_id),
      opponent_name: nameOf(d.opponent_id),
    }));
  });

export const listMyQuizzesForDuel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("quizzes")
      .select("id,title")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

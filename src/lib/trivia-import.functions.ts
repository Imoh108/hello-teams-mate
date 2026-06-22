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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const decode = (s: string) => {
  if (!s) return s;
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&eacute;/g, "é")
    .replace(/&Eacute;/g, "É")
    .replace(/&hellip;/g, "…")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&shy;/g, "")
    .replace(/&nbsp;/g, " ");
};

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// OpenTDB category id -> our slug
const OPENTDB_CATEGORIES: { id: number; slug: string }[] = [
  { id: 9, slug: "general-knowledge" },
  { id: 10, slug: "literature" }, // Books
  { id: 11, slug: "movies-tv" }, // Film
  { id: 12, slug: "music" },
  { id: 13, slug: "art-entertainment" }, // Musicals & Theatres
  { id: 14, slug: "movies-tv" }, // Television
  { id: 15, slug: "technology" }, // Video Games
  { id: 16, slug: "art-entertainment" }, // Board Games
  { id: 17, slug: "science-nature" },
  { id: 18, slug: "technology" }, // Computers
  { id: 19, slug: "science-nature" }, // Mathematics
  { id: 20, slug: "mythology-religion" },
  { id: 21, slug: "sports" },
  { id: 22, slug: "geography" },
  { id: 23, slug: "history" },
  { id: 24, slug: "general-knowledge" }, // Politics
  { id: 25, slug: "art-entertainment" }, // Art
  { id: 26, slug: "general-knowledge" }, // Celebrities
  { id: 27, slug: "science-nature" }, // Animals
  { id: 28, slug: "technology" }, // Vehicles
  { id: 29, slug: "art-entertainment" }, // Comics
  { id: 30, slug: "technology" }, // Gadgets
  { id: 31, slug: "movies-tv" }, // Anime & Manga
  { id: 32, slug: "movies-tv" }, // Cartoons
];

// The Trivia API category -> our slug
const TTA_CATEGORIES: Record<string, string> = {
  arts_and_literature: "literature",
  film_and_tv: "movies-tv",
  food_and_drink: "food-drink",
  general_knowledge: "general-knowledge",
  geography: "geography",
  history: "history",
  music: "music",
  science: "science-nature",
  society_and_culture: "general-knowledge",
  sport_and_leisure: "sports",
};

const diffMap = (d: string): number => {
  const k = (d || "").toLowerCase();
  if (k === "easy") return 1;
  if (k === "hard") return 5;
  return 3;
};

async function loadCategorySlugMap(admin: any): Promise<Map<string, string>> {
  const { data, error } = await admin.from("question_categories").select("id, slug");
  if (error) throw new Error(error.message);
  const m = new Map<string, string>();
  for (const r of data ?? []) m.set(r.slug, r.id);
  return m;
}

async function loadExistingPromptSet(admin: any): Promise<Set<string>> {
  const set = new Set<string>();
  const page = 1000;
  // ai_generated_items (up to 20k)
  let from = 0;
  for (let i = 0; i < 20; i++) {
    const { data, error } = await admin
      .from("ai_generated_items")
      .select("prompt")
      .range(from, from + page - 1);
    if (error) break;
    if (!data || data.length === 0) break;
    for (const r of data) set.add(norm(r.prompt));
    if (data.length < page) break;
    from += page;
  }
  // bank_questions (curated banks) — dedupe against those too
  from = 0;
  for (let i = 0; i < 20; i++) {
    const { data, error } = await admin
      .from("bank_questions")
      .select("prompt")
      .range(from, from + page - 1);
    if (error) break;
    if (!data || data.length === 0) break;
    for (const r of data) set.add(norm(r.prompt));
    if (data.length < page) break;
    from += page;
  }
  return set;
}

type Row = {
  job_id: null;
  topic: string;
  source: string;
  difficulty: number;
  prompt: string;
  choices: string[];
  correct_index: number;
  explanation: string | null;
  category_id: string | null;
  status: "approved";
  reviewed_by: string;
  reviewed_at: string;
};

// Upsert with ignoreDuplicates so the DB-level unique index on prompt_hash
// absorbs in-memory-set misses and race conditions across concurrent imports.
async function insertBatched(admin: any, rows: Row[]): Promise<{ inserted: number; deduped: number }> {
  let inserted = 0;
  let deduped = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { data, error } = await admin
      .from("ai_generated_items")
      .upsert(chunk, { onConflict: "prompt_hash", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(error.message);
    const got = data?.length ?? 0;
    inserted += got;
    deduped += chunk.length - got;
  }
  return { inserted, deduped };
}

async function runOpenTdb(opts: {
  admin: any;
  userId: string;
  maxPerCategory: number;
  catSlugToId: Map<string, string>;
  seen: Set<string>;
  onlyCategoryIds?: Set<number>;
}): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const { admin, userId, maxPerCategory, catSlugToId, seen, onlyCategoryIds } = opts;
  const errors: string[] = [];
  const rows: Row[] = [];
  let skipped = 0;
  const nowIso = new Date().toISOString();

  for (const cat of OPENTDB_CATEGORIES) {
    if (onlyCategoryIds && !onlyCategoryIds.has(cat.id)) continue;
    const catId = catSlugToId.get(cat.slug) ?? null;
    let collected = 0;
    let failures = 0;
    while (collected < maxPerCategory && failures < 3) {
      const url = `https://opentdb.com/api.php?amount=50&category=${cat.id}&type=multiple`;
      try {
        const res = await fetch(url);
        if (!res.ok) {
          failures++;
          await sleep(600);
          continue;
        }
        const json: any = await res.json();
        if (json?.response_code !== 0 || !Array.isArray(json.results) || json.results.length === 0) {
          failures++;
          await sleep(600);
          continue;
        }
        let newThisRound = 0;
        for (const q of json.results) {
          const prompt = decode(String(q.question ?? "")).trim();
          if (!prompt) continue;
          const key = norm(prompt);
          if (seen.has(key)) {
            skipped++;
            continue;
          }
          const correct = decode(String(q.correct_answer ?? "")).trim();
          const incorrect = (q.incorrect_answers ?? []).map((s: string) => decode(String(s)).trim()).filter(Boolean);
          if (!correct || incorrect.length !== 3) continue;
          const shuffled = shuffle([correct, ...incorrect]);
          const correct_index = shuffled.indexOf(correct);
          if (correct_index < 0) continue;
          seen.add(key);
          rows.push({
            job_id: null,
            topic: q.category ?? cat.slug,
            source: "Open Trivia DB",
            difficulty: diffMap(q.difficulty),
            prompt,
            choices: shuffled,
            correct_index,
            explanation: null,
            category_id: catId,
            status: "approved",
            reviewed_by: userId,
            reviewed_at: nowIso,
          });
          collected++;
          newThisRound++;
          if (collected >= maxPerCategory) break;
        }
        if (newThisRound === 0) failures++;
        await sleep(300);
      } catch (e: any) {
        failures++;
        errors.push(`OpenTDB cat ${cat.id}: ${String(e?.message ?? e).slice(0, 100)}`);
        await sleep(600);
      }
    }
  }
  const res = rows.length ? await insertBatched(admin, rows) : { inserted: 0, deduped: 0 };
  return { imported: res.inserted, skipped: skipped + res.deduped, errors };
}

async function runTriviaApi(opts: {
  admin: any;
  userId: string;
  maxPerCategory: number;
  catSlugToId: Map<string, string>;
  seen: Set<string>;
}): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const { admin, userId, maxPerCategory, catSlugToId, seen } = opts;
  const errors: string[] = [];
  const rows: Row[] = [];
  let skipped = 0;
  const nowIso = new Date().toISOString();

  for (const [apiCat, slug] of Object.entries(TTA_CATEGORIES)) {
    const catId = catSlugToId.get(slug) ?? null;
    let collected = 0;
    let failures = 0;
    while (collected < maxPerCategory && failures < 3) {
      const url = `https://the-trivia-api.com/v2/questions?limit=50&categories=${apiCat}&difficulties=easy,medium,hard`;
      try {
        const res = await fetch(url);
        if (!res.ok) {
          failures++;
          await sleep(600);
          continue;
        }
        const arr: any[] = await res.json();
        if (!Array.isArray(arr) || arr.length === 0) {
          failures++;
          await sleep(600);
          continue;
        }
        let newThisRound = 0;
        for (const q of arr) {
          const prompt = String(q?.question?.text ?? "").trim();
          if (!prompt) continue;
          const key = norm(prompt);
          if (seen.has(key)) {
            skipped++;
            continue;
          }
          const correct = String(q?.correctAnswer ?? "").trim();
          const incorrect = Array.isArray(q?.incorrectAnswers)
            ? q.incorrectAnswers.map((s: any) => String(s).trim()).filter(Boolean)
            : [];
          if (!correct || incorrect.length < 3) continue;
          const four = [correct, ...incorrect.slice(0, 3)];
          const shuffled = shuffle(four);
          const correct_index = shuffled.indexOf(correct);
          if (correct_index < 0) continue;
          seen.add(key);
          rows.push({
            job_id: null,
            topic: apiCat,
            source: "The Trivia API",
            difficulty: diffMap(q?.difficulty),
            prompt,
            choices: shuffled,
            correct_index,
            explanation: null,
            category_id: catId,
            status: "approved",
            reviewed_by: userId,
            reviewed_at: nowIso,
          });
          collected++;
          newThisRound++;
          if (collected >= maxPerCategory) break;
        }
        if (newThisRound === 0) failures++;
        await sleep(300);
      } catch (e: any) {
        failures++;
        errors.push(`TTA ${apiCat}: ${String(e?.message ?? e).slice(0, 100)}`);
        await sleep(600);
      }
    }
  }
  const res = rows.length ? await insertBatched(admin, rows) : { inserted: 0, deduped: 0 };
  return { imported: res.inserted, skipped: skipped + res.deduped, errors };
}

const Input = z.object({ maxPerCategory: z.number().int().min(10).max(500).default(200) });

async function logRun(
  admin: any,
  userId: string,
  source: string,
  startedAt: string,
  r: { imported: number; skipped: number; errors: string[] },
) {
  const fetched = r.imported + r.skipped;
  await admin.from("trivia_import_runs").insert({
    source,
    fetched,
    inserted: r.imported,
    deduplicated: r.skipped,
    error_count: r.errors.length,
    errors: r.errors.slice(0, 50),
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    run_by: userId,
  });
}

export const importFromOpenTriviaDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const catSlugToId = await loadCategorySlugMap(supabaseAdmin);
    const seen = await loadExistingPromptSet(supabaseAdmin);
    const startedAt = new Date().toISOString();
    const r = await runOpenTdb({
      admin: supabaseAdmin,
      userId: context.userId,
      maxPerCategory: data.maxPerCategory,
      catSlugToId,
      seen,
    });
    await logRun(supabaseAdmin, context.userId, "Open Trivia DB", startedAt, r);
    return { source: "Open Trivia DB", ...r };
  });

export const importFromTheTriviaApi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const catSlugToId = await loadCategorySlugMap(supabaseAdmin);
    const seen = await loadExistingPromptSet(supabaseAdmin);
    const startedAt = new Date().toISOString();
    const r = await runTriviaApi({
      admin: supabaseAdmin,
      userId: context.userId,
      maxPerCategory: data.maxPerCategory,
      catSlugToId,
      seen,
    });
    await logRun(supabaseAdmin, context.userId, "The Trivia API", startedAt, r);
    return { source: "The Trivia API", ...r };
  });

export const importAllTriviaBanks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const catSlugToId = await loadCategorySlugMap(supabaseAdmin);
    const seen = await loadExistingPromptSet(supabaseAdmin);
    const startA = new Date().toISOString();
    const a = await runOpenTdb({
      admin: supabaseAdmin,
      userId: context.userId,
      maxPerCategory: data.maxPerCategory,
      catSlugToId,
      seen,
    });
    await logRun(supabaseAdmin, context.userId, "Open Trivia DB", startA, a);
    const startB = new Date().toISOString();
    const b = await runTriviaApi({
      admin: supabaseAdmin,
      userId: context.userId,
      maxPerCategory: data.maxPerCategory,
      catSlugToId,
      seen,
    });
    await logRun(supabaseAdmin, context.userId, "The Trivia API", startB, b);
    return {
      imported: a.imported + b.imported,
      skipped: a.skipped + b.skipped,
      sources: [a, b].map((r, i) => ({ source: i === 0 ? "Open Trivia DB" : "The Trivia API", ...r })),
    };
  });

export const listImportRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context);
    const { data, error } = await context.supabase
      .from("trivia_import_runs")
      .select("id, source, fetched, inserted, deduplicated, error_count, errors, started_at, finished_at")
      .order("started_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { runs: data ?? [] };
  });

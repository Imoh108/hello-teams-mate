
## Goal

When a manager creates a new quiz, let them assemble it from the seeded question categories (the 12 we just added) by choosing categories, number of rounds, and questions per round — like a normal pub-quiz builder. No AI generation, no manual writing required.

## What changes

### 1. Database — add `round` to `questions`
Quizzes currently have no rounds concept. Add one small column so the round structure survives into gameplay/review.

- Migration: `ALTER TABLE public.questions ADD COLUMN round int NOT NULL DEFAULT 1;`
- Backfill existing rows stay at round 1. No RLS/GRANT change needed (existing policies still apply).

### 2. New server function — `createQuizFromCategories`
File: `src/lib/quiz.functions.ts`

Input:
- `title` (string), `description?` (string)
- `category_ids` (uuid[], min 1)
- `rounds` (int 1–10)
- `questions_per_round` (int 1–30)
- `time_limit_s` (int 5–120, default 20)
- `difficulty?` ('easy' | 'medium' | 'hard' | 'mixed', default 'mixed')

Behaviour:
- Upserts `manager` role for the caller (matches existing pattern).
- Inserts a `quizzes` row (`topic_pack: 'general_culture'`, owner = caller, org/department from caller's current org).
- Pulls approved `ai_generated_items` filtered by `category_id IN (...)` and difficulty bucket (1=easy, 3=medium, 5=hard; 'mixed' = no filter).
- Shuffles and takes `rounds * questions_per_round` items. Returns an error if the pool is smaller than requested, with the available count.
- Distributes across rounds round-robin so each round mixes categories evenly.
- Bulk-inserts into `questions` with `round` (1..N), sequential `position` (1..total), `options = choices`, `correct_index`, `time_limit_s`.
- Returns the new quiz row.

### 3. Update the "Create a quiz" dialog on `/app`
File: `src/routes/_authenticated/app.tsx`

Replace the current single form with a tabbed dialog:

- **From categories** (default tab)
  - Title, Description
  - Category multi-select: chips listing every `question_categories` row that has ≥1 approved question, with the approved count shown ("History · 50"). Categories with 0 questions appear disabled.
  - Rounds: number input (1–10, default 3)
  - Questions per round: number input (1–30, default 5)
  - Difficulty: segmented control (Easy / Medium / Hard / Mixed)
  - Time per question: slider (5–60s, default 20s)
  - Live summary line: "3 rounds × 5 questions = 15 total. Pool available: 250."
  - Submit → calls `createQuizFromCategories`, navigates to `/quizzes/$id`.

- **Blank** tab — the existing flow (title + description + topic pack) unchanged, for users who want to write their own questions.

### 4. Show round grouping in the quiz editor
File: `src/routes/_authenticated/quizzes.$id.tsx`

- Load `round` alongside questions, order by `round, position`.
- Render a `Round N` header before each group. Read-only display; no editing of `round` in this pass.
- New blank questions added via the existing "Add question" button default to `round = last round || 1`.

## Out of scope (call out, don't build)

- Round breaks / inter-round screens in the host runtime — host still plays questions sequentially in `position` order. Round labels are visible but don't pause the game. Say the word and I'll add round transitions next.
- Re-rolling / swapping individual questions after generation.
- Editing category assignments per question after generation.

## Technical notes

- `ai_generated_items.choices` is already `jsonb` with the 4 options — copied straight into `questions.options`.
- Sampling uses `ORDER BY random() LIMIT n` per category to keep it server-side and cheap.
- The function uses `requireSupabaseAuth` so RLS applies as the user; `quizzes`/`questions` inserts already work under existing policies (`createQuiz` uses the same path).

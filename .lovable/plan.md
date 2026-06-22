
## Goal

1. Bulk-import thousands of high-quality multiple-choice questions from public global trivia APIs into the existing `ai_generated_items` table as **auto-approved** items so they appear immediately in the quiz builder pool.
2. Verify the existing Firecrawl scraping pipeline still works (with a one-click admin health-check), since it's the secondary path for AI-generated questions.

## What gets built

### 1. New server module `src/lib/trivia-import.functions.ts`

Three platform-admin server functions (all use `requireSupabaseAuth` + `assertPlatformAdmin`, all write directly to `ai_generated_items` with `status='approved'`):

- **`importFromOpenTriviaDb`** — paginated fetch from `https://opentdb.com/api.php` (50 questions per call, looped per category, all difficulties). Maps OpenTDB's 24 categories → our 12 `question_categories` via a slug map (e.g. `Geography → geography`, `Entertainment: Film → film-tv`, `Science & Nature → science`). HTML-decodes prompts/choices, shuffles the 4 options, computes `correct_index`, dedupes against existing prompts (normalized lowercase).
- **`importFromTheTriviaApi`** — paginated fetch from `https://the-trivia-api.com/v2/questions?limit=50&difficulties=easy,medium,hard`. Maps their `category` field → our 12 categories. Same shuffle/dedupe/insert logic.
- **`importAllTriviaBanks`** — convenience wrapper that runs both importers back-to-back and returns combined totals.

All three accept an optional `maxPerCategory` (default 200) to cap volume. Inserts are batched at 200 rows.

### 2. Firecrawl health check `src/lib/firecrawl.functions.ts`

- **`testFirecrawl`** — admin-only server fn that scrapes `https://en.wikipedia.org/wiki/Quiz` and returns `{ ok, chars, preview }`. Surfaces gateway/credential failures clearly.

### 3. Admin UI: extend `src/routes/_authenticated/platform.content.tsx`

Add a new card **"Global question banks"** above the existing "Add source" card with three buttons + live result toasts:
- `Import from Open Trivia DB` → calls `importFromOpenTriviaDb`
- `Import from The Trivia API` → calls `importFromTheTriviaApi`
- `Import everything (recommended)` → calls `importAllTriviaBanks`
- `Test Firecrawl` (small ghost button) → calls `testFirecrawl`, shows ✅/❌ with character count or error.

Each button shows a loading toast and a success toast with the imported / skipped counts.

### 4. Quiz builder unchanged

The existing `createQuizFromCategories` / `listCategoryPool` already read approved `ai_generated_items` by `category_id`, so newly imported rows appear in the pool counts automatically — no further changes needed.

## Technical details

- **Category mapping** is a static map in `trivia-import.functions.ts` keyed by API category name → our `question_categories.slug`. Slugs that don't map fall back to `general-knowledge`.
- **Dedupe**: before each insert batch, fetch existing prompts from `ai_generated_items` (last 10k) into a Set, skip matches.
- **Rate limiting**: 250 ms `await sleep` between API page fetches to be polite.
- **No new tables / migrations needed** — everything reuses `ai_generated_items` and `question_categories`. Auto-approval = set `status='approved'`, `reviewed_at=now()`, `reviewed_by=context.userId`.
- **No new secrets** — Open Trivia DB and The Trivia API are both keyless. Firecrawl already configured via connector.

## Expected outcome

After clicking "Import everything", ~1500–3000 approved MCQs flow into the bank across the 12 categories within ~30 s. The quiz builder pool counts (currently 50 per seeded category) jump significantly, and the "Test Firecrawl" button confirms the scraping path is healthy for the AI-generation pipeline.

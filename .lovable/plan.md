# Pull questions from online sources, auto-categorised

## Why nothing happens today
- `content_sources` is a bookmark list — URLs are stored but never fetched.
- The AI pipeline only consumes text pasted into the "Reference material" box.
- Generated items carry a free-text `topic` string, with no real category taxonomy.

## What we'll build

### 1. Firecrawl connector
- Link the Firecrawl connector (`FIRECRAWL_API_KEY` injected as env).
- Add a thin server helper `src/lib/firecrawl.server.ts` that calls the Lovable connector gateway (`https://connector-gateway.lovable.dev/firecrawl/v2/scrape`) with `formats: ['markdown']` and `onlyMainContent: true`. Returns trimmed markdown (~12k chars).

### 2. Categories (AI auto-assigned)
- New table `public.question_categories` (name, slug unique, description). Seeded with a starter set (Compliance, Security, HR, Product, Sales, Engineering, Finance, Customer Service, Health & Safety, General). Platform admins manage it from a new tab on `/platform/content`.
- Add `category_id uuid` (nullable, FK → `question_categories`) to `ai_generated_items` and `bank_questions`.
- After AI generates a batch, a second short AI call classifies each question into one of the existing categories (returns the category slug). Unmatched → `general`.

### 3. "Generate from source" action
- On `/platform/content` each verified source row gets a **Generate** button → calls a new server fn `generateFromSource({ sourceId, count })`.
- The server fn:
  1. Loads the source, asserts platform admin.
  2. Scrapes the URL via Firecrawl helper.
  3. Creates an `ai_generation_jobs` row (`source = source.name`, `topic = source.topic`).
  4. Calls Gemini to generate `count` MCQs grounded in the scraped text (reusing the existing `QuestionSchema`).
  5. Calls Gemini once more to classify each question → `category_id`.
  6. Inserts into `ai_generated_items` with `status='pending'` and the chosen category.

### 4. Pipeline UI updates (`/platform/pipeline`)
- Review queue shows the AI-assigned **Category** badge next to topic/source, with a dropdown to override before approve.
- "Recent jobs" gains a per-category count summary.
- Existing manual "Generate" form stays as-is.

### 5. (Out of scope for this plan) scheduled crawl
- Per your choice ("Firecrawl scrape per source"), we trigger on-demand only. A nightly cron can be layered on later using the same server fn.

## Technical notes
- Firecrawl is called server-side only; API key never reaches the browser.
- Migration adds `question_categories`, seed rows, FK columns on `ai_generated_items` + `bank_questions`, plus GRANTs and RLS (platform_admin read/write on categories; existing policies cover the FK columns).
- No changes to `quizzes`/`questions` — categories live on bank/generated questions; quiz generation from banks already works.
- Approving an item carries `category_id` over when it's promoted into a bank question (extends the existing approve path).

## Files touched
- new: `src/lib/firecrawl.server.ts`
- edit: `src/lib/ai-pipeline.functions.ts` (add `generateFromSource`, AI categoriser, category in review/approve)
- edit: `src/lib/platform-content.functions.ts` (load sources with topic; expose category CRUD)
- edit: `src/routes/_authenticated/platform.content.tsx` (Generate button per source + Categories tab)
- edit: `src/routes/_authenticated/platform.pipeline.tsx` (category badge + override)
- migration: categories table, seed, FK columns, grants, policies

## Prerequisite (one click)
Link the Firecrawl connector when build starts. If you'd rather skip Firecrawl, say so and I'll fall back to plain server fetch + HTML-to-text (worse quality on JS-heavy sites).

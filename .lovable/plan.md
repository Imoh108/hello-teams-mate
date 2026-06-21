## Goal

Replace the existing 10 corporate-themed question categories with 12 classic trivia categories. Existing AI-generated questions currently tagged to old categories will be re-tagged to the new **General Knowledge** category (the safe fallback) so nothing is lost.

## New categories (12)

| # | Category | Description |
|---|---|---|
| 1 | General Knowledge | A bit of everything—geography, history, science, and culture |
| 2 | History | Events, people, and eras from ancient times to the modern day |
| 3 | Science & Nature | Biology, chemistry, physics, space, animals, and the natural world |
| 4 | Geography | Countries, capitals, landmarks, rivers, mountains, and maps |
| 5 | Movies & TV | Films, actors, directors, shows, quotes, and awards |
| 6 | Music | Artists, bands, albums, lyrics, instruments, and music history |
| 7 | Sports | Rules, records, teams, athletes, tournaments, and Olympics |
| 8 | Literature | Books, authors, poets, characters, quotes, and literary awards |
| 9 | Technology | Inventions, the internet, gadgets, coding, and tech companies |
| 10 | Food & Drink | Cuisines, ingredients, cocktails, cooking techniques, and famous chefs |
| 11 | Art & Entertainment | Paintings, artists, theater, video games, comics, and pop culture |
| 12 | Mythology & Religion | Greek, Norse, Egyptian myths, world religions, and legends |

Each will have a clean slug (`general-knowledge`, `history`, `science-nature`, `geography`, `movies-tv`, `music`, `sports`, `literature`, `technology`, `food-drink`, `art-entertainment`, `mythology-religion`).

## Plan

1. **Migration: reset categories.**
   - Insert the 12 new categories (idempotent — skip if slug already exists).
   - Re-point any `ai_generated_items.category_id` and `bank_questions.category_id` (if column exists) that reference the old corporate categories to the new `general-knowledge` row.
   - Delete the 10 old categories (Compliance, HR, Sales, Engineering, Finance, Health & Safety, Customer Service, Product, Security, plus the old "General" — replaced by General Knowledge).

2. **Update fallback slug in code.**
   - `src/lib/ai-pipeline.functions.ts` currently falls back to `slug === "general"` when categorising. Change the fallback to `general-knowledge` so the AI categoriser keeps working with the new set.

3. **No UI changes required.** The admin "Content" page already reads categories from the DB, so the new list appears automatically.

## Difficulty split note

The 15/20/15 easy-medium-hard counts per category are a **content target**, not a schema field. Questions already have a 1–5 `difficulty` column, so this is achieved by generating/approving the right mix — not by changing tables. I'll surface this as a guideline in the admin generator UI in a future pass if you'd like, but it's out of scope for this seeding task.

## Out of scope

- Actually generating the 50 questions per category (600 total). Say the word after this lands and I'll wire the AI pipeline to bulk-generate them per category using the existing `generatePlatformQuestions` flow.

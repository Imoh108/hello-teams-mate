## Goal
Enhance `/platform/imports` with filtering, richer error visibility, CSV export, and one-click retry for failed/partial bank runs.

## Changes

### 1. Filters (bank, date range, status)
In `src/routes/_authenticated/platform.imports.tsx`:
- Add a filter bar above the history table:
  - **Bank**: multi-select (`Open Trivia DB`, `The Trivia API`) sourced from distinct `source` values in the loaded runs.
  - **Date range**: two date pickers (from / to) using shadcn `Calendar` in a `Popover` — defaults empty (all time).
  - **Status**: select with `All` / `Clean` (error_count = 0) / `Errors` (error_count > 0) / `Partial` (inserted < fetched AND error_count > 0).
- Filter the `runs` array client-side before rendering "All runs" table and latest-per-source cards.
- Persist filter state in URL search params via TanStack `validateSearch` (`bank[]`, `from`, `to`, `status`) so links/refresh preserve view.

### 2. Per-bank error details
- Errors are already stored as `errors jsonb[]` (up to 50 per run) and the source/category prefix is included (e.g. `OpenTDB cat 23: <message>`).
- In the "Last run per source" cards: keep the existing collapsible, but render errors grouped by category prefix (parse `Source cat X:` / `TTA <slug>:` → group key) with count + sample messages.
- In the "All runs" table: add an expandable row (chevron) that, when toggled, shows the same grouped error breakdown for that run.
- No backend change needed (data already persisted).

### 3. CSV export
- Add two buttons in the header:
  - **Export last run** — exports the latest run's per-source summary + its errors (one row per error).
  - **Export full history** — exports filtered runs as one row per run with columns: `started_at, finished_at, duration_ms, source, fetched, deduplicated, inserted, error_count`.
- Pure client-side CSV builder (no new deps); trigger download via `Blob` + anchor click. Filename includes ISO date.

### 4. One-click Retry
- A run is "retry-worthy" when `error_count > 0` OR `inserted < fetched` (partial).
- On qualifying cards (latest-per-source) and rows (table), show a **Retry** button.
- Wire it to the existing server functions: `importFromOpenTriviaDb` for `source = "Open Trivia DB"`, `importFromTheTriviaApi` for `source = "The Trivia API"`. Reuse `useServerFn` + toast feedback, then refresh runs.
- No new server function needed — dedup already prevents duplicate inserts, so re-running is safe and only fills gaps.

## Technical notes
- All work is in `src/routes/_authenticated/platform.imports.tsx` plus a small `src/lib/csv.ts` helper for CSV escaping.
- No DB migration required; `errors`, `fetched`, `inserted`, `deduplicated`, `error_count` are already on `trivia_import_runs`.
- No changes to `src/lib/trivia-import.functions.ts` — retry calls existing import functions.
- Bank list is hardcoded to the two known sources (matches the import buttons in `platform.content.tsx`).

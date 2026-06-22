# Import enhancements plan

Three features added on top of the existing `/platform/imports` page.

## 1. Dashboard widget: latest import runs

Add a new card to `src/routes/_authenticated/platform.index.tsx` (the platform dashboard) titled "Recent imports".

- Reuses the existing `listImportRuns` server function — no new backend.
- Shows the last 5 runs as compact rows: source, time-ago, fetched / inserted / dedup counts, status pill.
- Highlights two conditions in red/amber:
  - `error_count > 0` → red "Errors" badge with count.
  - `inserted < fetched * 0.5` AND `fetched >= 20` → amber "Low yield" badge (unusually low insertion rate vs. fetched, ignoring tiny runs).
- "View all" link → `/platform/imports`.

## 2. Retry only failed categories (not whole bank)

The current "Retry" button re-runs the entire bank. We change it to re-run only the *categories that produced errors* in that run.

Approach (no schema change — error strings already carry the category):
- Errors are stored as `"OpenTDB cat 23: ..."` or `"TTA geography: ..."`. We parse them to a set of failing category IDs/slugs per source.
- New server fn `retryFailedFromRun({ runId })` in `src/lib/trivia-import.functions.ts`:
  - Loads the run row, extracts the failed category list from `errors[]`.
  - Calls a refactored `runOpenTdb` / `runTriviaApi` with an optional `categoryFilter` arg so the existing per-category loops skip non-failing categories.
  - Logs a new run with `source` suffixed `" (retry)"` so the history clearly shows scoped retries.
- On the imports page, the "Retry" button on a failed/partial card or row calls this new fn. If a run has no parseable failed categories (e.g. only top-level network errors), fall back to the existing full retry and toast "no scoped failures found — retrying full bank".

Dedup already prevents duplicate inserts, so retries are safe.

## 3. Shareable CSV export links

Currently CSVs are generated client-side and downloaded. We add a "Copy share link" action next to each Export button.

- New private storage bucket `import-exports` (created via migration).
- New server fn `createExportLink({ filename, csv })`:
  - Uploads the CSV to `import-exports/{userId}/{uuid}.csv`.
  - Returns a 7-day signed URL via `supabaseAdmin.storage.from(...).createSignedUrl(path, 60*60*24*7)`.
  - Authorized to `platform_admin` only (callers).
- UI changes in `platform.imports.tsx`:
  - Each export button gets a sibling "Share" button (link icon). Click → builds the same CSV, posts to `createExportLink`, copies signed URL to clipboard, toasts "Link copied (valid 7 days)".
  - Same for the "Export last run" CSV.

Recipients open the signed URL directly — no auth needed for the link itself, but the link expires in 7 days and is unguessable.

## Files

- `src/lib/trivia-import.functions.ts` — refactor `runOpenTdb`/`runTriviaApi` to accept optional category filter; add `retryFailedFromRun`, `createExportLink`.
- `src/routes/_authenticated/platform.imports.tsx` — wire scoped retry + share buttons.
- `src/routes/_authenticated/platform.index.tsx` — add "Recent imports" widget.
- `supabase/migrations/<timestamp>_import_exports_bucket.sql` — create private storage bucket with RLS allowing `platform_admin` to read/write own folder, plus signed-URL access.

## Notes / trade-offs

- Scoped retry relies on parsing error strings. If we later want pinpoint per-question retry, we'd need to persist the raw failed payloads (new column / table) — not in this change.
- Signed-URL approach avoids building a public download route and keeps the bucket private.
- "Low yield" threshold (50% with min 20 fetched) is a sensible default; easy to tune later.

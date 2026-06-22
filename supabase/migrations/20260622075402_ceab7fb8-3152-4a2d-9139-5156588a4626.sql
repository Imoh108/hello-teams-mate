
ALTER TABLE public.ai_generated_items
  ADD COLUMN IF NOT EXISTS prompt_hash text
  GENERATED ALWAYS AS (md5(lower(regexp_replace(coalesce(prompt, ''), '\s+', ' ', 'g')))) STORED;

-- Remove pre-existing duplicates (keep earliest by created_at, fall back to id) so the unique index can be built.
DELETE FROM public.ai_generated_items a
USING public.ai_generated_items b
WHERE a.prompt_hash = b.prompt_hash
  AND (a.created_at, a.id) > (b.created_at, b.id);

CREATE UNIQUE INDEX IF NOT EXISTS ai_generated_items_prompt_hash_key
  ON public.ai_generated_items (prompt_hash);

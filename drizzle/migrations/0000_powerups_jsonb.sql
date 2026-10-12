-- Power-ups: per-player remaining counts + per-question usage, stored on the player row.
ALTER TABLE public.session_players
  ADD COLUMN IF NOT EXISTS powerups jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.session_players.powerups IS 'Power-up wallet: {"fifty_fifty":1,"double":1,"freeze":1,"used":{"<questionId>":["fifty_fifty","double","freeze"]}}';
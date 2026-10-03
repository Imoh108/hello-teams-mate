ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS team_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.session_players ADD COLUMN IF NOT EXISTS team_index integer;
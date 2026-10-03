CREATE TABLE public.daily_streaks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  last_played date,
  total_correct integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.daily_streaks TO authenticated;
GRANT ALL ON public.daily_streaks TO service_role;
ALTER TABLE public.daily_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own streak read" ON public.daily_streaks FOR SELECT TO authenticated USING (user_id = auth.uid());
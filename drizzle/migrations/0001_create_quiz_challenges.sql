CREATE TABLE public.quiz_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id),
  challenger_id uuid NOT NULL,
  opponent_id uuid,
  challenger_session_id uuid REFERENCES public.sessions(id),
  opponent_session_id uuid REFERENCES public.sessions(id),
  status text NOT NULL DEFAULT 'open',
  winner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days'
);

GRANT SELECT, INSERT, UPDATE ON public.quiz_challenges TO authenticated;
GRANT ALL ON public.quiz_challenges TO service_role;

ALTER TABLE public.quiz_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants read duels"
  ON public.quiz_challenges FOR SELECT TO authenticated
  USING (challenger_id = auth.uid() OR opponent_id = auth.uid() OR opponent_id IS NULL);

CREATE POLICY "challenger creates duels"
  ON public.quiz_challenges FOR INSERT TO authenticated
  WITH CHECK (challenger_id = auth.uid());

CREATE POLICY "participants update duels"
  ON public.quiz_challenges FOR UPDATE TO authenticated
  USING (challenger_id = auth.uid() OR opponent_id = auth.uid() OR opponent_id IS NULL);
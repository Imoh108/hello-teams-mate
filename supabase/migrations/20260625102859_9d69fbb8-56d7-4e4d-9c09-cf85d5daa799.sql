CREATE POLICY "session participants read questions"
ON public.questions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.quiz_id = questions.quiz_id
      AND (s.host_id = auth.uid() OR public.is_session_player(s.id, auth.uid()))
  )
);
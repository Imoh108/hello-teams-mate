CREATE TABLE public.scheduled_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  title text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  created_by uuid NOT NULL,
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_quizzes TO authenticated;
GRANT ALL ON public.scheduled_quizzes TO service_role;
ALTER TABLE public.scheduled_quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read schedules" ON public.scheduled_quizzes FOR SELECT TO authenticated
  USING (public.is_org_member(org_id, auth.uid()));
CREATE POLICY "members create schedules" ON public.scheduled_quizzes FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_org_member(org_id, auth.uid()));
CREATE POLICY "creator or admin updates schedules" ON public.scheduled_quizzes FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_org_admin(org_id, auth.uid()));
CREATE POLICY "creator or admin deletes schedules" ON public.scheduled_quizzes FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_org_admin(org_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.weekly_league(_org uuid, _since timestamptz)
RETURNS TABLE(user_id uuid, display_name text, points bigint, answers bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.user_id, p.display_name,
         COALESCE(SUM(a.points),0)::bigint, COUNT(a.id)::bigint
  FROM public.organization_members m
  JOIN public.profiles p ON p.id = m.user_id
  LEFT JOIN public.answers a ON a.user_id = m.user_id AND a.answered_at >= _since
  WHERE m.org_id = _org AND public.is_org_member(_org, auth.uid())
  GROUP BY m.user_id, p.display_name
  ORDER BY 3 DESC, 2
$$;
REVOKE EXECUTE ON FUNCTION public.weekly_league(uuid, timestamptz) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.weekly_league(uuid, timestamptz) TO authenticated;

-- Helper: is user a player in this session? (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_session_player(_session_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.session_players
    WHERE session_id = _session_id AND user_id = _user_id
  )
$$;

-- Helper: is user the host of this session?
CREATE OR REPLACE FUNCTION public.is_session_host(_session_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions
    WHERE id = _session_id AND host_id = _user_id
  )
$$;

-- Rewrite sessions SELECT policy (fixes typo + recursion)
DROP POLICY IF EXISTS "session readable by participants" ON public.sessions;
CREATE POLICY "session readable by participants" ON public.sessions
  FOR SELECT TO authenticated
  USING (
    host_id = auth.uid()
    OR public.is_session_player(id, auth.uid())
  );

-- Rewrite session_players SELECT policy to avoid recursion
DROP POLICY IF EXISTS "players visible to participants" ON public.session_players;
CREATE POLICY "players visible to participants" ON public.session_players
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_session_host(session_id, auth.uid())
  );

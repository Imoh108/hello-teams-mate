-- 1. search_path on tier_rank
CREATE OR REPLACE FUNCTION public.tier_rank(_t subscription_tier)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT CASE _t WHEN 'basic' THEN 1 WHEN 'premium' THEN 2 WHEN 'enterprise' THEN 3 END $$;

-- 2. Revoke EXECUTE on privileged SECURITY DEFINER functions (server/service_role only)
REVOKE ALL ON FUNCTION public.award_points(uuid, uuid, text, integer, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.join_or_create_tenant_org(uuid, uuid, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_points(uuid, uuid, text, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.join_or_create_tenant_org(uuid, uuid, text, text) TO service_role;
-- RLS predicate helpers are not needed as direct API calls
REVOKE EXECUTE ON FUNCTION public.org_tier(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.org_has_tier(uuid, subscription_tier) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, org_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM anon;

-- 3. Profiles: scope reads
CREATE OR REPLACE FUNCTION public.shares_context_with(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _a = _b
      OR EXISTS (
        SELECT 1 FROM public.organization_members m1
        JOIN public.organization_members m2 ON m1.org_id = m2.org_id
        WHERE m1.user_id = _a AND m2.user_id = _b)
      OR EXISTS (
        SELECT 1 FROM public.session_players p1
        JOIN public.session_players p2 ON p1.session_id = p2.session_id
        WHERE p1.user_id = _a AND p2.user_id = _b)
      OR EXISTS (
        SELECT 1 FROM public.sessions s
        JOIN public.session_players p ON p.session_id = s.id
        WHERE (s.host_id = _a AND p.user_id = _b) OR (s.host_id = _b AND p.user_id = _a))
$$;
REVOKE ALL ON FUNCTION public.shares_context_with(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shares_context_with(uuid, uuid) TO service_role;

DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;
CREATE POLICY "profiles readable in shared context" ON public.profiles
FOR SELECT TO authenticated
USING (public.shares_context_with(auth.uid(), id));

-- 4. Organization invites: no open token lookup
DROP POLICY IF EXISTS "lookup invite by token" ON public.organization_invites;

CREATE OR REPLACE FUNCTION public.accept_org_invite(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.organization_invites;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO inv FROM public.organization_invites WHERE token = _token;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'Invite not found'; END IF;
  IF inv.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'Invite already used'; END IF;
  IF inv.expires_at < now() THEN RAISE EXCEPTION 'Invite expired'; END IF;

  INSERT INTO public.organization_members (org_id, user_id, org_role, department_id)
  VALUES (inv.org_id, auth.uid(), inv.org_role, inv.department_id)
  ON CONFLICT (org_id, user_id) DO UPDATE
    SET org_role = EXCLUDED.org_role, department_id = EXCLUDED.department_id;

  UPDATE public.organization_invites SET accepted_at = now() WHERE id = inv.id;
  RETURN inv.org_id;
END $$;
REVOKE ALL ON FUNCTION public.accept_org_invite(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.accept_org_invite(text) TO authenticated, service_role;

-- 5. Storage: exclude guest (anonymous) users from training documents
DROP POLICY IF EXISTS "org members read training docs" ON storage.objects;
DROP POLICY IF EXISTS "org admins insert training docs" ON storage.objects;
DROP POLICY IF EXISTS "org admins update training docs" ON storage.objects;
DROP POLICY IF EXISTS "org admins delete training docs" ON storage.objects;

CREATE POLICY "org members read training docs" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'training-documents'
  AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  AND public.is_org_member((split_part(name, '/', 1))::uuid, auth.uid()));

CREATE POLICY "org admins insert training docs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'training-documents'
  AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  AND public.is_org_admin((split_part(name, '/', 1))::uuid, auth.uid()));

CREATE POLICY "org admins update training docs" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'training-documents'
  AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  AND public.is_org_admin((split_part(name, '/', 1))::uuid, auth.uid()));

CREATE POLICY "org admins delete training docs" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'training-documents'
  AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  AND public.is_org_admin((split_part(name, '/', 1))::uuid, auth.uid()));

-- 6. import-exports bucket: owner-only read, writes via service role only
DROP POLICY IF EXISTS "owners read own export files" ON storage.objects;
CREATE POLICY "owners read own export files" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'import-exports'
  AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  AND split_part(name, '/', 1) = auth.uid()::text);
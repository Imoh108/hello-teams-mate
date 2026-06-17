
-- 1. organizations: tenant_id + tenant_name
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS tenant_id uuid,
  ADD COLUMN IF NOT EXISTS tenant_name text;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_tenant_id_key
  ON public.organizations(tenant_id) WHERE tenant_id IS NOT NULL;

-- 2. departments: teams_team_id + teams_channel_id
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS teams_team_id text,
  ADD COLUMN IF NOT EXISTS teams_channel_id text;

CREATE UNIQUE INDEX IF NOT EXISTS departments_teams_channel_id_key
  ON public.departments(teams_channel_id) WHERE teams_channel_id IS NOT NULL;

-- 3. profiles: entra_oid + entra_tid
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS entra_oid text,
  ADD COLUMN IF NOT EXISTS entra_tid text;

-- 4. join_or_create_tenant_org RPC
CREATE OR REPLACE FUNCTION public.join_or_create_tenant_org(
  _user uuid,
  _tid uuid,
  _tenant_name text,
  _display text
) RETURNS TABLE (org_id uuid, role org_role, created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_org uuid;
  personal_org uuid;
  personal_member_count int;
  personal_has_content boolean;
  result_role org_role;
  result_created boolean := false;
BEGIN
  -- Stamp Entra identity on profile
  UPDATE public.profiles
     SET entra_oid = COALESCE(entra_oid, _user::text),
         entra_tid = _tid::text
   WHERE id = _user;

  -- Look up tenant org
  SELECT id INTO existing_org FROM public.organizations WHERE tenant_id = _tid LIMIT 1;

  -- Find user's personal auto-created workspace (if any), the most recent one they own
  SELECT o.id INTO personal_org
    FROM public.organizations o
   WHERE o.created_by = _user
     AND o.tenant_id IS NULL
   ORDER BY o.created_at DESC
   LIMIT 1;

  IF existing_org IS NOT NULL THEN
    -- Join the tenant org
    INSERT INTO public.organization_members (org_id, user_id, org_role)
    VALUES (existing_org, _user, 'member')
    ON CONFLICT (org_id, user_id) DO NOTHING;

    SELECT org_role INTO result_role
      FROM public.organization_members
     WHERE org_id = existing_org AND user_id = _user;

    -- Clean up empty personal workspace
    IF personal_org IS NOT NULL THEN
      SELECT count(*) INTO personal_member_count
        FROM public.organization_members WHERE org_id = personal_org;
      SELECT EXISTS(SELECT 1 FROM public.question_banks WHERE org_id = personal_org)
          OR EXISTS(SELECT 1 FROM public.quizzes WHERE org_id = personal_org)
        INTO personal_has_content;
      IF personal_member_count <= 1 AND NOT personal_has_content THEN
        DELETE FROM public.organization_members WHERE org_id = personal_org;
        DELETE FROM public.organizations WHERE id = personal_org;
      END IF;
    END IF;

    RETURN QUERY SELECT existing_org, result_role, false;
  ELSE
    -- Promote personal workspace to tenant org, or create one
    IF personal_org IS NOT NULL THEN
      UPDATE public.organizations
         SET tenant_id = _tid,
             tenant_name = _tenant_name,
             name = COALESCE(NULLIF(_tenant_name, ''), name)
       WHERE id = personal_org;
      result_created := true;
      RETURN QUERY SELECT personal_org, 'owner'::org_role, result_created;
    ELSE
      INSERT INTO public.organizations (name, tenant_id, tenant_name, subscription_tier, data_backend, created_by)
      VALUES (COALESCE(NULLIF(_tenant_name, ''), _display || '''s workspace'), _tid, _tenant_name, 'enterprise', 'lovable_cloud', _user)
      RETURNING id INTO existing_org;
      INSERT INTO public.organization_members (org_id, user_id, org_role)
      VALUES (existing_org, _user, 'owner');
      RETURN QUERY SELECT existing_org, 'owner'::org_role, true;
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_or_create_tenant_org(uuid, uuid, text, text) TO service_role;

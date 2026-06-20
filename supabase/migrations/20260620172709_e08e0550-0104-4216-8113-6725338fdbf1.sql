
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_org_id uuid;
  display text;
  is_first_user boolean;
  base_slug text;
  final_slug text;
  n int := 0;
BEGIN
  display := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email,'@',1)
  );

  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO is_first_user;

  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id, display, NEW.raw_user_meta_data->>'avatar_url');

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'player');

  IF is_first_user THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'platform_admin')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Build a unique slug for the new workspace
  base_slug := regexp_replace(lower(display), '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  IF base_slug = '' OR base_slug IS NULL THEN
    base_slug := 'workspace';
  END IF;
  final_slug := base_slug || '-' || substr(NEW.id::text, 1, 8);
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = final_slug) LOOP
    n := n + 1;
    final_slug := base_slug || '-' || substr(NEW.id::text, 1, 8) || '-' || n;
  END LOOP;

  INSERT INTO public.organizations (name, slug, subscription_tier, data_backend, created_by)
  VALUES (display || '''s workspace', final_slug, 'enterprise', 'lovable_cloud', NEW.id)
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_members (org_id, user_id, org_role)
  VALUES (new_org_id, NEW.id, 'owner');

  RETURN NEW;
END $function$;

-- Also ensure join_or_create_tenant_org provides slug when creating a new tenant org
CREATE OR REPLACE FUNCTION public.join_or_create_tenant_org(_user uuid, _tid uuid, _tenant_name text, _display text)
 RETURNS TABLE(org_id uuid, role org_role, created boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing_org uuid;
  personal_org uuid;
  personal_member_count int;
  personal_has_content boolean;
  result_role org_role;
  result_created boolean := false;
  base_slug text;
  final_slug text;
  n int := 0;
BEGIN
  UPDATE public.profiles
     SET entra_oid = COALESCE(entra_oid, _user::text),
         entra_tid = _tid::text
   WHERE id = _user;

  SELECT id INTO existing_org FROM public.organizations WHERE tenant_id = _tid LIMIT 1;

  SELECT o.id INTO personal_org
    FROM public.organizations o
   WHERE o.created_by = _user
     AND o.tenant_id IS NULL
   ORDER BY o.created_at DESC
   LIMIT 1;

  IF existing_org IS NOT NULL THEN
    INSERT INTO public.organization_members (org_id, user_id, org_role)
    VALUES (existing_org, _user, 'member')
    ON CONFLICT (org_id, user_id) DO NOTHING;

    SELECT org_role INTO result_role
      FROM public.organization_members
     WHERE org_id = existing_org AND user_id = _user;

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
    IF personal_org IS NOT NULL THEN
      UPDATE public.organizations
         SET tenant_id = _tid,
             tenant_name = _tenant_name,
             name = COALESCE(NULLIF(_tenant_name, ''), name)
       WHERE id = personal_org;
      result_created := true;
      RETURN QUERY SELECT personal_org, 'owner'::org_role, result_created;
    ELSE
      base_slug := regexp_replace(lower(COALESCE(NULLIF(_tenant_name, ''), _display, 'workspace')), '[^a-z0-9]+', '-', 'g');
      base_slug := trim(both '-' from base_slug);
      IF base_slug = '' OR base_slug IS NULL THEN base_slug := 'workspace'; END IF;
      final_slug := base_slug || '-' || substr(_tid::text, 1, 8);
      WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = final_slug) LOOP
        n := n + 1;
        final_slug := base_slug || '-' || substr(_tid::text, 1, 8) || '-' || n;
      END LOOP;

      INSERT INTO public.organizations (name, slug, tenant_id, tenant_name, subscription_tier, data_backend, created_by)
      VALUES (COALESCE(NULLIF(_tenant_name, ''), _display || '''s workspace'), final_slug, _tid, _tenant_name, 'enterprise', 'lovable_cloud', _user)
      RETURNING id INTO existing_org;
      INSERT INTO public.organization_members (org_id, user_id, org_role)
      VALUES (existing_org, _user, 'owner');
      RETURN QUERY SELECT existing_org, 'owner'::org_role, true;
    END IF;
  END IF;
END;
$function$;


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
    split_part(NEW.email,'@',1),
    'Guest'
  );

  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id, display, NEW.raw_user_meta_data->>'avatar_url');

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'player');

  -- Guest (anonymous) users: skip org/workspace + platform_admin bootstrap.
  IF COALESCE(NEW.is_anonymous, false) THEN
    RETURN NEW;
  END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE COALESCE(u.is_anonymous, false) = false AND p.id <> NEW.id
  ) INTO is_first_user;

  IF is_first_user THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'platform_admin')
    ON CONFLICT DO NOTHING;
  END IF;

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

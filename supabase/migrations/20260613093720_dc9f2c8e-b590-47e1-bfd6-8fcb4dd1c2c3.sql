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

  INSERT INTO public.organizations (name, subscription_tier, data_backend, created_by)
  VALUES (display || '''s workspace', 'enterprise', 'lovable_cloud', NEW.id)
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_members (org_id, user_id, org_role)
  VALUES (new_org_id, NEW.id, 'owner');

  RETURN NEW;
END $function$;
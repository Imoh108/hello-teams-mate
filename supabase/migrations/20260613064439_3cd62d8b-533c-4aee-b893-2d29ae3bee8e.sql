
ALTER TABLE public.organizations ALTER COLUMN subscription_tier SET DEFAULT 'enterprise';
UPDATE public.organizations SET subscription_tier = 'enterprise';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_org_id uuid;
  display text;
BEGIN
  display := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email,'@',1)
  );

  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id, display, NEW.raw_user_meta_data->>'avatar_url');

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'player');

  INSERT INTO public.organizations (name, subscription_tier, data_backend, created_by)
  VALUES (display || '''s workspace', 'enterprise', 'lovable_cloud', NEW.id)
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_members (org_id, user_id, org_role)
  VALUES (new_org_id, NEW.id, 'owner');

  RETURN NEW;
END $$;

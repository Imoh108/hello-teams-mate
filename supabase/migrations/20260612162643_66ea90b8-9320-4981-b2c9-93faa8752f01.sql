
-- Tier enum
CREATE TYPE public.subscription_tier AS ENUM ('basic','premium','enterprise');

ALTER TABLE public.organizations
  ADD COLUMN subscription_tier public.subscription_tier NOT NULL DEFAULT 'basic';

-- Bump any existing seeded orgs to enterprise so demo flows keep working
UPDATE public.organizations SET subscription_tier = 'enterprise';

-- Ordering helper
CREATE OR REPLACE FUNCTION public.tier_rank(_t public.subscription_tier)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _t WHEN 'basic' THEN 1 WHEN 'premium' THEN 2 WHEN 'enterprise' THEN 3 END
$$;

CREATE OR REPLACE FUNCTION public.org_tier(_org uuid)
RETURNS public.subscription_tier
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT subscription_tier FROM public.organizations WHERE id = _org $$;

CREATE OR REPLACE FUNCTION public.org_has_tier(_org uuid, _min public.subscription_tier)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.tier_rank(COALESCE((SELECT subscription_tier FROM public.organizations WHERE id = _org), 'basic'))
       >= public.tier_rank(_min)
$$;

-- Dataverse only for enterprise
CREATE OR REPLACE FUNCTION public.enforce_dataverse_tier()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.data_backend = 'dataverse' AND NEW.subscription_tier <> 'enterprise' THEN
    RAISE EXCEPTION 'Dataverse backend requires the enterprise tier';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS enforce_dataverse_tier ON public.organizations;
CREATE TRIGGER enforce_dataverse_tier
BEFORE INSERT OR UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.enforce_dataverse_tier();

-- Tighten write policies on premium-gated tables
-- question_banks
DROP POLICY IF EXISTS "Org admins manage banks" ON public.question_banks;
CREATE POLICY "Org admins manage banks" ON public.question_banks
  FOR ALL TO authenticated
  USING (public.is_org_admin(org_id, auth.uid()))
  WITH CHECK (public.is_org_admin(org_id, auth.uid()) AND public.org_has_tier(org_id, 'premium'));

-- bank_questions (scope via parent bank)
DROP POLICY IF EXISTS "Org admins manage bank questions" ON public.bank_questions;
CREATE POLICY "Org admins manage bank questions" ON public.bank_questions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.question_banks b WHERE b.id = bank_id AND public.is_org_admin(b.org_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.question_banks b WHERE b.id = bank_id AND public.is_org_admin(b.org_id, auth.uid()) AND public.org_has_tier(b.org_id, 'premium')));

DROP POLICY IF EXISTS "Org admins manage bank tags" ON public.bank_tags;
CREATE POLICY "Org admins manage bank tags" ON public.bank_tags
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.question_banks b WHERE b.id = bank_id AND public.is_org_admin(b.org_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.question_banks b WHERE b.id = bank_id AND public.is_org_admin(b.org_id, auth.uid()) AND public.org_has_tier(b.org_id, 'premium')));

DROP POLICY IF EXISTS "Org admins manage documents" ON public.training_documents;
CREATE POLICY "Org admins manage documents" ON public.training_documents
  FOR ALL TO authenticated
  USING (public.is_org_admin(org_id, auth.uid()))
  WITH CHECK (public.is_org_admin(org_id, auth.uid()) AND public.org_has_tier(org_id, 'premium'));

-- Enterprise gated tables
DROP POLICY IF EXISTS "Org admins manage avatar items" ON public.avatar_items;
CREATE POLICY "Org admins manage avatar items" ON public.avatar_items
  FOR ALL TO authenticated
  USING (org_id IS NULL OR public.is_org_admin(org_id, auth.uid()))
  WITH CHECK (org_id IS NOT NULL AND public.is_org_admin(org_id, auth.uid()) AND public.org_has_tier(org_id, 'enterprise'));

DROP POLICY IF EXISTS "Org admins manage badges" ON public.badges;
CREATE POLICY "Org admins manage badges" ON public.badges
  FOR ALL TO authenticated
  USING (org_id IS NULL OR public.is_org_admin(org_id, auth.uid()))
  WITH CHECK (org_id IS NOT NULL AND public.is_org_admin(org_id, auth.uid()) AND public.org_has_tier(org_id, 'enterprise'));

DROP POLICY IF EXISTS "Org admins manage challenges" ON public.challenges;
CREATE POLICY "Org admins manage challenges" ON public.challenges
  FOR ALL TO authenticated
  USING (public.is_org_admin(org_id, auth.uid()))
  WITH CHECK (public.is_org_admin(org_id, auth.uid()) AND public.org_has_tier(org_id, 'enterprise'));


-- Profiles: add gamification columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS equipped_avatar_id uuid;

-- Avatar items (catalog). org_id null = global
CREATE TABLE public.avatar_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'avatar',
  image_url text NOT NULL,
  cost_points integer NOT NULL DEFAULT 0,
  rarity text NOT NULL DEFAULT 'common',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avatar_items TO authenticated;
GRANT ALL ON public.avatar_items TO service_role;
ALTER TABLE public.avatar_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed can read items"
  ON public.avatar_items FOR SELECT TO authenticated
  USING (org_id IS NULL OR public.is_org_member(org_id, auth.uid()));
CREATE POLICY "Org admins manage items"
  ON public.avatar_items FOR ALL TO authenticated
  USING (org_id IS NOT NULL AND public.is_org_admin(org_id, auth.uid()))
  WITH CHECK (org_id IS NOT NULL AND public.is_org_admin(org_id, auth.uid()));

-- User-owned items
CREATE TABLE public.user_avatar_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.avatar_items(id) ON DELETE CASCADE,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_id)
);
GRANT SELECT, INSERT, DELETE ON public.user_avatar_items TO authenticated;
GRANT ALL ON public.user_avatar_items TO service_role;
ALTER TABLE public.user_avatar_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own items" ON public.user_avatar_items
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own items" ON public.user_avatar_items
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Badges (catalog). org_id null = global
CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT '🏅',
  criteria_type text NOT NULL DEFAULT 'manual',
  criteria_value integer,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.badges TO authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed reads badges" ON public.badges
  FOR SELECT TO authenticated
  USING (org_id IS NULL OR public.is_org_member(org_id, auth.uid()));
CREATE POLICY "Org admins manage badges" ON public.badges
  FOR ALL TO authenticated
  USING (org_id IS NOT NULL AND public.is_org_admin(org_id, auth.uid()))
  WITH CHECK (org_id IS NOT NULL AND public.is_org_admin(org_id, auth.uid()));

-- Earned badges
CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);
GRANT SELECT, INSERT, DELETE ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own badges" ON public.user_badges
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Org admins read org badges" ON public.user_badges
  FOR SELECT TO authenticated
  USING (org_id IS NOT NULL AND public.is_org_admin(org_id, auth.uid()));

-- Challenges
CREATE TABLE public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  start_at timestamptz NOT NULL DEFAULT now(),
  end_at timestamptz NOT NULL,
  target_points integer NOT NULL DEFAULT 100,
  reward_badge_id uuid REFERENCES public.badges(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members read challenges" ON public.challenges
  FOR SELECT TO authenticated USING (public.is_org_member(org_id, auth.uid()));
CREATE POLICY "Org admins manage challenges" ON public.challenges
  FOR ALL TO authenticated
  USING (public.is_org_admin(org_id, auth.uid()))
  WITH CHECK (public.is_org_admin(org_id, auth.uid()));

-- Challenge participants
CREATE TABLE public.challenge_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_progress integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_participants TO authenticated;
GRANT ALL ON public.challenge_participants TO service_role;
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own participation" ON public.challenge_participants
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Org admins see all participation" ON public.challenge_participants
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.challenges c
                 WHERE c.id = challenge_id AND public.is_org_admin(c.org_id, auth.uid())));
CREATE POLICY "Users join/update own participation" ON public.challenge_participants
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own participation" ON public.challenge_participants
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Point events audit log
CREATE TABLE public.point_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  source text NOT NULL,
  delta integer NOT NULL,
  ref_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.point_events TO authenticated;
GRANT ALL ON public.point_events TO service_role;
ALTER TABLE public.point_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own point events" ON public.point_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own point events" ON public.point_events
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Org admins read org point events" ON public.point_events
  FOR SELECT TO authenticated
  USING (org_id IS NOT NULL AND public.is_org_admin(org_id, auth.uid()));

-- Award points RPC: increments profiles.points and writes a point_event in one call.
CREATE OR REPLACE FUNCTION public.award_points(_user uuid, _org uuid, _source text, _delta integer, _ref uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_total integer;
BEGIN
  INSERT INTO public.point_events(user_id, org_id, source, delta, ref_id)
  VALUES (_user, _org, _source, _delta, _ref);
  UPDATE public.profiles SET points = COALESCE(points, 0) + _delta
   WHERE id = _user
  RETURNING points INTO new_total;
  -- progress active challenges in the org
  IF _org IS NOT NULL AND _delta > 0 THEN
    UPDATE public.challenge_participants cp
       SET current_progress = current_progress + _delta,
           completed_at = CASE
             WHEN completed_at IS NULL AND current_progress + _delta >= c.target_points
             THEN now() ELSE completed_at END
      FROM public.challenges c
     WHERE cp.challenge_id = c.id
       AND cp.user_id = _user
       AND c.org_id = _org
       AND now() BETWEEN c.start_at AND c.end_at;
  END IF;
  RETURN COALESCE(new_total, 0);
END; $$;

REVOKE ALL ON FUNCTION public.award_points(uuid,uuid,text,integer,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_points(uuid,uuid,text,integer,uuid) TO authenticated, service_role;

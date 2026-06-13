
CREATE TABLE public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admins manage settings" ON public.platform_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

INSERT INTO public.platform_settings(key, value) VALUES
  ('quiz_defaults', '{"timer_seconds":20,"max_players":50,"anticheat_sensitivity":"medium"}'::jsonb),
  ('notifications', '{"welcome_subject":"Welcome to QuizPulse","billing_subject":"Your QuizPulse invoice","churn_subject":"We miss you"}'::jsonb)
ON CONFLICT (key) DO NOTHING;


CREATE TABLE public.content_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  topic TEXT,
  license TEXT,
  notes TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_sources TO authenticated;
GRANT ALL ON public.content_sources TO service_role;
ALTER TABLE public.content_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admins manage sources" ON public.content_sources
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER content_sources_touch BEFORE UPDATE ON public.content_sources
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

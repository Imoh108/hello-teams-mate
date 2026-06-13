
CREATE TABLE IF NOT EXISTS public.ai_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  topic text,
  status text NOT NULL DEFAULT 'pending',
  prompt text,
  generated_count integer NOT NULL DEFAULT 0,
  approved_count integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,
  error_message text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_jobs_status_created ON public.ai_generation_jobs (status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_generation_jobs TO authenticated;
GRANT ALL ON public.ai_generation_jobs TO service_role;

ALTER TABLE public.ai_generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform admins manage ai jobs"
  ON public.ai_generation_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

CREATE TRIGGER trg_ai_jobs_updated
  BEFORE UPDATE ON public.ai_generation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

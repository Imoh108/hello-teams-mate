CREATE TABLE public.ai_generated_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.ai_generation_jobs(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  choices jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_index integer NOT NULL DEFAULT 0,
  explanation text,
  difficulty integer NOT NULL DEFAULT 2,
  topic text,
  source text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_items_status ON public.ai_generated_items(status, created_at DESC);
CREATE INDEX idx_ai_items_job ON public.ai_generated_items(job_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_generated_items TO authenticated;
GRANT ALL ON public.ai_generated_items TO service_role;

ALTER TABLE public.ai_generated_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform admins manage ai items"
  ON public.ai_generated_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'));

CREATE TRIGGER trg_ai_items_updated
  BEFORE UPDATE ON public.ai_generated_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
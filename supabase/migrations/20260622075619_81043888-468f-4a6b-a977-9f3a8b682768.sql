
CREATE TABLE public.trivia_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  fetched integer NOT NULL DEFAULT 0,
  inserted integer NOT NULL DEFAULT 0,
  deduplicated integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  run_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.trivia_import_runs TO authenticated;
GRANT ALL ON public.trivia_import_runs TO service_role;

ALTER TABLE public.trivia_import_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view import runs"
ON public.trivia_import_runs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'));

CREATE INDEX trivia_import_runs_started_at_idx ON public.trivia_import_runs (started_at DESC);

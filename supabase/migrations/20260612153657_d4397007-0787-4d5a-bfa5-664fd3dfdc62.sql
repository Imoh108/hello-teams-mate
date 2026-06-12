
CREATE TABLE public.question_banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_banks TO authenticated;
GRANT ALL ON public.question_banks TO service_role;
ALTER TABLE public.question_banks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view banks" ON public.question_banks FOR SELECT TO authenticated
  USING (public.is_org_member(org_id, auth.uid()));
CREATE POLICY "admins manage banks" ON public.question_banks FOR ALL TO authenticated
  USING (public.is_org_admin(org_id, auth.uid()))
  WITH CHECK (public.is_org_admin(org_id, auth.uid()));
CREATE TRIGGER tg_question_banks_updated BEFORE UPDATE ON public.question_banks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_question_banks_org ON public.question_banks(org_id);

CREATE TABLE public.bank_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id uuid NOT NULL REFERENCES public.question_banks(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  choices jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_index int NOT NULL DEFAULT 0,
  explanation text,
  difficulty int NOT NULL DEFAULT 1,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_questions TO authenticated;
GRANT ALL ON public.bank_questions TO service_role;
ALTER TABLE public.bank_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view bank questions" ON public.bank_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.question_banks b WHERE b.id = bank_id AND public.is_org_member(b.org_id, auth.uid())));
CREATE POLICY "admins manage bank questions" ON public.bank_questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.question_banks b WHERE b.id = bank_id AND public.is_org_admin(b.org_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.question_banks b WHERE b.id = bank_id AND public.is_org_admin(b.org_id, auth.uid())));
CREATE TRIGGER tg_bank_questions_updated BEFORE UPDATE ON public.bank_questions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_bank_questions_bank ON public.bank_questions(bank_id);

CREATE TABLE public.bank_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id uuid NOT NULL REFERENCES public.question_banks(id) ON DELETE CASCADE,
  tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bank_id, tag)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_tags TO authenticated;
GRANT ALL ON public.bank_tags TO service_role;
ALTER TABLE public.bank_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view bank tags" ON public.bank_tags FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.question_banks b WHERE b.id = bank_id AND public.is_org_member(b.org_id, auth.uid())));
CREATE POLICY "admins manage bank tags" ON public.bank_tags FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.question_banks b WHERE b.id = bank_id AND public.is_org_admin(b.org_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.question_banks b WHERE b.id = bank_id AND public.is_org_admin(b.org_id, auth.uid())));

CREATE TABLE public.training_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  bank_id uuid REFERENCES public.question_banks(id) ON DELETE SET NULL,
  uploaded_by uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'uploaded',
  extracted_text text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_documents TO authenticated;
GRANT ALL ON public.training_documents TO service_role;
ALTER TABLE public.training_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view training docs" ON public.training_documents FOR SELECT TO authenticated
  USING (public.is_org_member(org_id, auth.uid()));
CREATE POLICY "admins manage training docs" ON public.training_documents FOR ALL TO authenticated
  USING (public.is_org_admin(org_id, auth.uid()))
  WITH CHECK (public.is_org_admin(org_id, auth.uid()));
CREATE TRIGGER tg_training_documents_updated BEFORE UPDATE ON public.training_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_training_documents_org ON public.training_documents(org_id);


CREATE TABLE public.question_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.question_categories TO authenticated;
GRANT ALL ON public.question_categories TO service_role;

ALTER TABLE public.question_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read categories"
  ON public.question_categories FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Platform admins manage categories"
  ON public.question_categories FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

CREATE TRIGGER question_categories_touch
  BEFORE UPDATE ON public.question_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.question_categories (name, slug, description) VALUES
  ('Compliance', 'compliance', 'Regulatory, legal, GDPR, policies'),
  ('Security', 'security', 'Information security, phishing, infosec'),
  ('HR', 'hr', 'People, culture, onboarding'),
  ('Product', 'product', 'Product knowledge and features'),
  ('Sales', 'sales', 'Sales process, methodology, pitches'),
  ('Engineering', 'engineering', 'Technical, software, dev practices'),
  ('Finance', 'finance', 'Accounting, budgeting, financial literacy'),
  ('Customer Service', 'customer-service', 'Support and customer success'),
  ('Health & Safety', 'health-safety', 'Workplace H&S, ergonomics, first aid'),
  ('General', 'general', 'Uncategorised / fallback');

ALTER TABLE public.ai_generated_items
  ADD COLUMN category_id uuid REFERENCES public.question_categories(id) ON DELETE SET NULL;

ALTER TABLE public.bank_questions
  ADD COLUMN category_id uuid REFERENCES public.question_categories(id) ON DELETE SET NULL;

CREATE INDEX ai_generated_items_category_idx ON public.ai_generated_items(category_id);
CREATE INDEX bank_questions_category_idx ON public.bank_questions(category_id);


-- Insert new trivia categories (idempotent via slug unique)
INSERT INTO public.question_categories (slug, name, description) VALUES
('general-knowledge', 'General Knowledge', 'A bit of everything—geography, history, science, and culture'),
('history', 'History', 'Events, people, and eras from ancient times to the modern day'),
('science-nature', 'Science & Nature', 'Biology, chemistry, physics, space, animals, and the natural world'),
('geography', 'Geography', 'Countries, capitals, landmarks, rivers, mountains, and maps'),
('movies-tv', 'Movies & TV', 'Films, actors, directors, shows, quotes, and awards'),
('music', 'Music', 'Artists, bands, albums, lyrics, instruments, and music history'),
('sports', 'Sports', 'Rules, records, teams, athletes, tournaments, and Olympics'),
('literature', 'Literature', 'Books, authors, poets, characters, quotes, and literary awards'),
('technology', 'Technology', 'Inventions, the internet, gadgets, coding, and tech companies'),
('food-drink', 'Food & Drink', 'Cuisines, ingredients, cocktails, cooking techniques, and famous chefs'),
('art-entertainment', 'Art & Entertainment', 'Paintings, artists, theater, video games, comics, and pop culture'),
('mythology-religion', 'Mythology & Religion', 'Greek, Norse, Egyptian myths, world religions, and legends')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Re-point existing tagged questions to General Knowledge
WITH gk AS (SELECT id FROM public.question_categories WHERE slug = 'general-knowledge')
UPDATE public.ai_generated_items SET category_id = (SELECT id FROM gk)
WHERE category_id IN (
  SELECT id FROM public.question_categories
  WHERE slug IN ('general','compliance','hr','sales','engineering','finance','health-safety','customer-service','product','security')
);

WITH gk AS (SELECT id FROM public.question_categories WHERE slug = 'general-knowledge')
UPDATE public.bank_questions SET category_id = (SELECT id FROM gk)
WHERE category_id IN (
  SELECT id FROM public.question_categories
  WHERE slug IN ('general','compliance','hr','sales','engineering','finance','health-safety','customer-service','product','security')
);

-- Remove old corporate categories
DELETE FROM public.question_categories
WHERE slug IN ('general','compliance','hr','sales','engineering','finance','health-safety','customer-service','product','security');

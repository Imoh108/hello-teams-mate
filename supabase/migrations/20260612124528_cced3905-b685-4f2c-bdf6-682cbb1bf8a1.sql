
DO $$
DECLARE q1 uuid; q2 uuid; q3 uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.quizzes WHERE is_public = true AND title = 'Office Trivia Starter') THEN
    INSERT INTO public.quizzes (owner_id, title, description, topic_pack, is_public)
    VALUES (NULL, 'Office Trivia Starter', 'Light warm-up questions for any team.', 'company_trivia', true) RETURNING id INTO q1;
    INSERT INTO public.questions (quiz_id, position, prompt, options, correct_index, time_limit_s) VALUES
      (q1, 1, 'What does the "www" in a website URL stand for?', '["World Web Wide","World Wide Web","Web World Wide","Wide World Web"]'::jsonb, 1, 20),
      (q1, 2, 'Which key combination copies text on most systems?', '["Ctrl+V","Ctrl+X","Ctrl+C","Ctrl+Z"]'::jsonb, 2, 15),
      (q1, 3, 'In a typical meeting, what does "ASAP" mean?', '["As Soon As Possible","Always Send A Plan","After Standard Action Plan","A Simple Approval Process"]'::jsonb, 0, 15),
      (q1, 4, 'What does HR most commonly stand for?', '["High Rank","Human Resources","Hourly Rate","Hiring Review"]'::jsonb, 1, 15),
      (q1, 5, 'Which tool is primarily used for spreadsheets?', '["PowerPoint","Word","Excel","Outlook"]'::jsonb, 2, 15);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.quizzes WHERE is_public = true AND title = 'Tech Industry Knowledge') THEN
    INSERT INTO public.quizzes (owner_id, title, description, topic_pack, is_public)
    VALUES (NULL, 'Tech Industry Knowledge', 'Test your tech-industry fluency.', 'industry_knowledge', true) RETURNING id INTO q2;
    INSERT INTO public.questions (quiz_id, position, prompt, options, correct_index, time_limit_s) VALUES
      (q2, 1, 'What does "API" stand for?', '["Applied Process Internal","Application Programming Interface","Automated Program Input","Advanced Program Integration"]'::jsonb, 1, 20),
      (q2, 2, 'Which company makes the Azure cloud platform?', '["Amazon","Google","Microsoft","Oracle"]'::jsonb, 2, 15),
      (q2, 3, 'What does "SaaS" stand for?', '["Software as a Service","System as a Solution","Storage as a Service","Service and Support"]'::jsonb, 0, 15),
      (q2, 4, 'Which language runs natively in web browsers?', '["Python","JavaScript","Ruby","Go"]'::jsonb, 1, 15),
      (q2, 5, 'Git is primarily a tool for…', '["Project planning","Version control","Bug tracking","Code editing"]'::jsonb, 1, 15);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.quizzes WHERE is_public = true AND title = 'General Culture') THEN
    INSERT INTO public.quizzes (owner_id, title, description, topic_pack, is_public)
    VALUES (NULL, 'General Culture', 'A mix of geography, science, and arts.', 'general_culture', true) RETURNING id INTO q3;
    INSERT INTO public.questions (quiz_id, position, prompt, options, correct_index, time_limit_s) VALUES
      (q3, 1, 'What is the capital of Australia?', '["Sydney","Melbourne","Canberra","Perth"]'::jsonb, 2, 20),
      (q3, 2, 'How many continents are there?', '["5","6","7","8"]'::jsonb, 2, 15),
      (q3, 3, 'Which planet is known as the Red Planet?', '["Venus","Mars","Jupiter","Saturn"]'::jsonb, 1, 15),
      (q3, 4, 'Who painted the Mona Lisa?', '["Michelangelo","Raphael","Leonardo da Vinci","Donatello"]'::jsonb, 2, 15),
      (q3, 5, 'What is the largest ocean on Earth?', '["Atlantic","Indian","Arctic","Pacific"]'::jsonb, 3, 15);
  END IF;
END $$;

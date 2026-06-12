
CREATE TYPE public.app_role AS ENUM ('manager','player');
CREATE TYPE public.topic_pack AS ENUM ('company_trivia','industry_knowledge','general_culture','custom');
CREATE TYPE public.session_status AS ENUM ('lobby','active','reveal','ended');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'player');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  topic_pack topic_pack NOT NULL DEFAULT 'custom',
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT ALL ON public.quizzes TO service_role;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quizzes readable" ON public.quizzes FOR SELECT TO authenticated USING (is_public OR owner_id = auth.uid());
CREATE POLICY "owner inserts quiz" ON public.quizzes FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner updates quiz" ON public.quizzes FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "owner deletes quiz" ON public.quizzes FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  position INT NOT NULL,
  prompt TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_index INT NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  time_limit_s INT NOT NULL DEFAULT 20 CHECK (time_limit_s BETWEEN 5 AND 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(quiz_id, position)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questions readable" ON public.questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND (q.is_public OR q.owner_id = auth.uid())));
CREATE POLICY "owner manages questions" ON public.questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.owner_id = auth.uid()));

CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  join_code TEXT NOT NULL UNIQUE,
  status session_status NOT NULL DEFAULT 'lobby',
  current_question_id UUID REFERENCES public.questions(id),
  question_started_at TIMESTAMPTZ,
  time_limit_override_s INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);
CREATE INDEX sessions_join_code_idx ON public.sessions(join_code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.session_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  flagged_count INT NOT NULL DEFAULT 0,
  UNIQUE(session_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_players TO authenticated;
GRANT ALL ON public.session_players TO service_role;
ALTER TABLE public.session_players ENABLE ROW LEVEL SECURITY;

-- Now policies that cross-reference
CREATE POLICY "session readable by participants" ON public.sessions FOR SELECT TO authenticated
  USING (host_id = auth.uid() OR EXISTS (SELECT 1 FROM public.session_players sp WHERE sp.session_id = id AND sp.user_id = auth.uid()));
CREATE POLICY "host creates session" ON public.sessions FOR INSERT TO authenticated WITH CHECK (host_id = auth.uid());
CREATE POLICY "host updates session" ON public.sessions FOR UPDATE TO authenticated USING (host_id = auth.uid());
CREATE POLICY "host deletes session" ON public.sessions FOR DELETE TO authenticated USING (host_id = auth.uid());

CREATE POLICY "players visible to participants" ON public.session_players FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND (s.host_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.session_players sp2 WHERE sp2.session_id = s.id AND sp2.user_id = auth.uid()))));
CREATE POLICY "user joins as self" ON public.session_players FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "host updates players" ON public.session_players FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.host_id = auth.uid()));

CREATE TABLE public.answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_index INT,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  time_taken_ms INT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  points INT NOT NULL DEFAULT 0,
  flagged BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(session_id, question_id, user_id)
);
CREATE INDEX answers_session_idx ON public.answers(session_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.answers TO authenticated;
GRANT ALL ON public.answers TO service_role;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "host or self reads answers" ON public.answers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.host_id = auth.uid()));
CREATE POLICY "player inserts own answer" ON public.answers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

ALTER TABLE public.sessions REPLICA IDENTITY FULL;
ALTER TABLE public.session_players REPLICA IDENTITY FULL;
ALTER TABLE public.answers REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.answers;

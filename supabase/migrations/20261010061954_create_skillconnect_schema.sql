/*
# SkillConnect — Full Schema

1. Purpose
   Student skill exchange platform: students share skills, send learning requests,
   chat, schedule sessions, track progress, rate each other, and earn certificates.

2. New Tables
   - profiles: extends auth.users with full_name, department, bio
   - skills: skills a user offers (name, category, proficiency, description, preference)
   - skill_requests: learning requests between students (pending/accepted/rejected/completed/cancelled)
   - messages: 1:1 chat messages between students linked to an accepted request
   - sessions: scheduled learning sessions (date, time, mode, meeting link, status)
   - progress: learning progress records (in_progress / completed)
   - feedback: 1-5 star ratings + text feedback after completion
   - certificates: auto-created certificate records on completion

3. Security (RLS)
   - profiles: all authenticated users can read (for browsing), only owner can update
   - skills: all authenticated can read, only owner can insert/update/delete
   - skill_requests: requester or recipient can read; only requester can insert; only recipient can update status
   - messages: sender or receiver can read; only sender can insert
   - sessions: both participants can read; either can insert; both can update
   - progress: owner can read/insert/update
   - feedback: anyone authenticated can read (public feedback); only rater can insert
   - certificates: owner can read; auto-inserted via service role or by the learner
*/

-- ===== PROFILES =====
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  department text NOT NULL DEFAULT 'General',
  bio text DEFAULT '',
  avatar_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_read_all" ON profiles;
CREATE POLICY "profiles_read_all" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ===== SKILLS =====
CREATE TABLE IF NOT EXISTS skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  proficiency_level text NOT NULL DEFAULT 'Intermediate',
  description text DEFAULT '',
  learning_preference text NOT NULL DEFAULT 'Both',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "skills_read_all" ON skills;
CREATE POLICY "skills_read_all" ON skills FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "skills_insert_own" ON skills;
CREATE POLICY "skills_insert_own" ON skills FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "skills_update_own" ON skills;
CREATE POLICY "skills_update_own" ON skills FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "skills_delete_own" ON skills;
CREATE POLICY "skills_delete_own" ON skills FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_skills_user_id ON skills(user_id);
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);

-- ===== SKILL REQUESTS =====
CREATE TABLE IF NOT EXISTS skill_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  message text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE skill_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "requests_read_parties" ON skill_requests;
CREATE POLICY "requests_read_parties" ON skill_requests FOR SELECT
  TO authenticated USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "requests_insert_requester" ON skill_requests;
CREATE POLICY "requests_insert_requester" ON skill_requests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "requests_update_receiver" ON skill_requests;
CREATE POLICY "requests_update_receiver" ON skill_requests FOR UPDATE
  TO authenticated USING (auth.uid() = requester_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = requester_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "requests_delete_requester" ON skill_requests;
CREATE POLICY "requests_delete_requester" ON skill_requests FOR DELETE
  TO authenticated USING (auth.uid() = requester_id);

CREATE INDEX IF NOT EXISTS idx_requests_requester ON skill_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_requests_receiver ON skill_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON skill_requests(status);

-- ===== MESSAGES =====
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid REFERENCES skill_requests(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_read_parties" ON messages;
CREATE POLICY "messages_read_parties" ON messages FOR SELECT
  TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "messages_insert_sender" ON messages;
CREATE POLICY "messages_insert_sender" ON messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = sender_id);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

-- ===== SESSIONS =====
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES skill_requests(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  mentor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  session_time time NOT NULL,
  mode text NOT NULL DEFAULT 'Online',
  meeting_link text DEFAULT '',
  status text NOT NULL DEFAULT 'Scheduled',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sessions_read_parties" ON sessions;
CREATE POLICY "sessions_read_parties" ON sessions FOR SELECT
  TO authenticated USING (auth.uid() = mentor_id OR auth.uid() = learner_id);

DROP POLICY IF EXISTS "sessions_insert_parties" ON sessions;
CREATE POLICY "sessions_insert_parties" ON sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = mentor_id OR auth.uid() = learner_id);

DROP POLICY IF EXISTS "sessions_update_parties" ON sessions;
CREATE POLICY "sessions_update_parties" ON sessions FOR UPDATE
  TO authenticated USING (auth.uid() = mentor_id OR auth.uid() = learner_id)
  WITH CHECK (auth.uid() = mentor_id OR auth.uid() = learner_id);

CREATE INDEX IF NOT EXISTS idx_sessions_mentor ON sessions(mentor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_learner ON sessions(learner_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(session_date);

-- ===== PROGRESS =====
CREATE TABLE IF NOT EXISTS progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES skill_requests(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'in_progress',
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "progress_read_own" ON progress;
CREATE POLICY "progress_read_own" ON progress FOR SELECT
  TO authenticated USING (auth.uid() = learner_id);

DROP POLICY IF EXISTS "progress_insert_own" ON progress;
CREATE POLICY "progress_insert_own" ON progress FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = learner_id);

DROP POLICY IF EXISTS "progress_update_own" ON progress;
CREATE POLICY "progress_update_own" ON progress FOR UPDATE
  TO authenticated USING (auth.uid() = learner_id) WITH CHECK (auth.uid() = learner_id);

DROP POLICY IF EXISTS "progress_delete_own" ON progress;
CREATE POLICY "progress_delete_own" ON progress FOR DELETE
  TO authenticated USING (auth.uid() = learner_id);

CREATE INDEX IF NOT EXISTS idx_progress_learner ON progress(learner_id);
CREATE INDEX IF NOT EXISTS idx_progress_skill ON progress(skill_id);

-- ===== FEEDBACK =====
CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES skill_requests(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  rater_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  ratee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feedback_read_all" ON feedback;
CREATE POLICY "feedback_read_all" ON feedback FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "feedback_insert_rater" ON feedback;
CREATE POLICY "feedback_insert_rater" ON feedback FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = rater_id);

DROP POLICY IF EXISTS "feedback_delete_rater" ON feedback;
CREATE POLICY "feedback_delete_rater" ON feedback FOR DELETE
  TO authenticated USING (auth.uid() = rater_id);

CREATE INDEX IF NOT EXISTS idx_feedback_ratee ON feedback(ratee_id);
CREATE INDEX IF NOT EXISTS idx_feedback_rater ON feedback(rater_id);

-- ===== CERTIFICATES =====
CREATE TABLE IF NOT EXISTS certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  skill_name text NOT NULL,
  mentor_name text DEFAULT '',
  reference_code text NOT NULL DEFAULT '',
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(learner_id, skill_id)
);

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "certificates_read_own" ON certificates;
CREATE POLICY "certificates_read_own" ON certificates FOR SELECT
  TO authenticated USING (auth.uid() = learner_id);

DROP POLICY IF EXISTS "certificates_insert_own" ON certificates;
CREATE POLICY "certificates_insert_own" ON certificates FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = learner_id);

CREATE INDEX IF NOT EXISTS idx_certificates_learner ON certificates(learner_id);

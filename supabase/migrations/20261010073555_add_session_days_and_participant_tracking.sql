/*
# Add session_days table, session_participants table, and feedback.session_day_id column

## Purpose
Support day-wise learning records within a session, per-participant session completion tracking,
and feedback linked to a specific learning day.

## New Tables

### session_days
Stores each learning day within a session. Both mentor and learner see and edit the same records.
- id (uuid, PK)
- session_id (uuid, FK → sessions.id ON DELETE CASCADE)
- day_number (int, not null) — Day 1, Day 2, etc.
- topics_text (text) — free-form topics planned/covered for this day
- notes (text) — what was taught / learning notes
- created_at (timestamptz, default now())
- Unique constraint on (session_id, day_number) to prevent duplicates.

### session_participants
Tracks each participant's own session-exit status independently.
- id (uuid, PK)
- session_id (uuid, FK → sessions.id ON DELETE CASCADE)
- user_id (uuid, FK → profiles.id ON DELETE CASCADE)
- ended_at (timestamptz, nullable) — when this participant clicked End Session
- unique constraint on (session_id, user_id) so each participant has one record.

## Modified Tables

### feedback
- Added column session_day_id (uuid, nullable, FK → session_days.id ON DELETE SET NULL)
  This links feedback to a specific learning day within a session.

## Security
- RLS enabled on session_days and session_participants.
- Policies allow authenticated users who are either the mentor or learner of the session
  to read/write session_days and their own session_participants record.
- Existing feedback policies remain unchanged; the new column is covered by existing
  insert/update policies since the owner check (rater_id = auth.uid()) still applies.
*/

-- session_days table
CREATE TABLE IF NOT EXISTS session_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  day_number int NOT NULL,
  topics_text text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Prevent duplicate day records for the same session + day number
CREATE UNIQUE INDEX IF NOT EXISTS session_days_session_id_day_number_key
  ON session_days (session_id, day_number);

ALTER TABLE session_days ENABLE ROW LEVEL SECURITY;

-- A participant (mentor or learner) of the session can read session_days
DROP POLICY IF EXISTS "select_session_days" ON session_days;
CREATE POLICY "select_session_days"
  ON session_days FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_days.session_id
        AND (s.mentor_id = auth.uid() OR s.learner_id = auth.uid())
    )
  );

-- A participant can insert/update session_days
DROP POLICY IF EXISTS "insert_session_days" ON session_days;
CREATE POLICY "insert_session_days"
  ON session_days FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_days.session_id
        AND (s.mentor_id = auth.uid() OR s.learner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "update_session_days" ON session_days;
CREATE POLICY "update_session_days"
  ON session_days FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_days.session_id
        AND (s.mentor_id = auth.uid() OR s.learner_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_days.session_id
        AND (s.mentor_id = auth.uid() OR s.learner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "delete_session_days" ON session_days;
CREATE POLICY "delete_session_days"
  ON session_days FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_days.session_id
        AND (s.mentor_id = auth.uid() OR s.learner_id = auth.uid())
    )
  );

-- session_participants table
CREATE TABLE IF NOT EXISTS session_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS session_participants_session_id_user_id_key
  ON session_participants (session_id, user_id);

ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_session_participants" ON session_participants;
CREATE POLICY "select_session_participants"
  ON session_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_participants.session_id
        AND (s.mentor_id = auth.uid() OR s.learner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "insert_session_participants" ON session_participants;
CREATE POLICY "insert_session_participants"
  ON session_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_participants.session_id
        AND (s.mentor_id = auth.uid() OR s.learner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "update_session_participants" ON session_participants;
CREATE POLICY "update_session_participants"
  ON session_participants FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Add session_day_id column to feedback
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'feedback' AND column_name = 'session_day_id'
  ) THEN
    ALTER TABLE feedback ADD COLUMN session_day_id uuid REFERENCES session_days(id) ON DELETE SET NULL;
  END IF;
END $$;

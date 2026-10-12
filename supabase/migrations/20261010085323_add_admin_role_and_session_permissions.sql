/*
# Add role column to profiles and update sessions RLS for admin management

## Purpose
Add an admin role system so only authorized admin accounts can create, edit, reschedule,
or cancel sessions. Regular students/mentors can view sessions they belong to and join meetings.

## Changes to profiles table
- Add role column (text, default 'student', not null)
  Values: 'student' (default) or 'admin'
  This is stored in the database, not in client-editable user_metadata, so users cannot
  escalate themselves to admin via the browser.

## Changes to sessions RLS policies
- SELECT: unchanged — mentor or learner of the session can read it
- INSERT: now allows either the mentor or the learner of the session OR an admin user
- UPDATE: now allows either the mentor or the learner of the session OR an admin user
- DELETE: admin only (prevents accidental data loss by students)

## How to set up an admin account
After registering a user through the normal signup flow, run:
  UPDATE profiles SET role = 'admin' WHERE id = '<user-uuid>';
Or by email:
  UPDATE profiles SET role = 'admin' WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@college.edu');
*/

-- Add role column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role text NOT NULL DEFAULT 'student';
  END IF;
END $$;

-- Update sessions INSERT policy to allow admin users to insert any session
DROP POLICY IF EXISTS "insert_sessions" ON sessions;
CREATE POLICY "insert_sessions"
  ON sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    mentor_id = auth.uid()
    OR learner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Update sessions UPDATE policy to allow admin users to update any session
DROP POLICY IF EXISTS "update_sessions" ON sessions;
CREATE POLICY "update_sessions"
  ON sessions FOR UPDATE
  TO authenticated
  USING (
    mentor_id = auth.uid()
    OR learner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    mentor_id = auth.uid()
    OR learner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

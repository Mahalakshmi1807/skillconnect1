/*
# Fix foreign keys on skill_requests, sessions, and feedback to point to profiles instead of auth.users

## Problem
The foreign key constraints on skill_requests.requester_id, skill_requests.receiver_id,
sessions.mentor_id, sessions.learner_id, feedback.rater_id, and feedback.ratee_id
all point to auth.users(id). This prevents PostgREST from joining these tables to
the `profiles` table, because the FK doesn't reference `profiles`.

When the frontend tries:
  skill_requests.select('*, requester_profile:profiles!skill_requests_requester_id_fkey(full_name)')
PostgREST resolves the FK hint `skill_requests_requester_id_fkey` → sees it points to
auth.users, not profiles → returns an error/null → the query produces no profile data,
making Sent Requests and Received Requests appear blank.

## Fix
Drop the 6 existing FK constraints and recreate them pointing to profiles(id) instead
of auth.users(id). Since profiles.id already has its own FK to auth.users(id) with
ON DELETE CASCADE, data integrity is fully preserved.

## Changes
- skill_requests: drop & recreate requester_id, receiver_id FKs → profiles(id)
- sessions: drop & recreate mentor_id, learner_id FKs → profiles(id)
- feedback: drop & recreate rater_id, ratee_id FKs → profiles(id)

No data is deleted or modified. Only constraint definitions change.
*/

-- skill_requests
ALTER TABLE skill_requests DROP CONSTRAINT IF EXISTS skill_requests_requester_id_fkey;
ALTER TABLE skill_requests DROP CONSTRAINT IF EXISTS skill_requests_receiver_id_fkey;

ALTER TABLE skill_requests
  ADD CONSTRAINT skill_requests_requester_id_fkey
    FOREIGN KEY (requester_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE skill_requests
  ADD CONSTRAINT skill_requests_receiver_id_fkey
    FOREIGN KEY (receiver_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- sessions
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_mentor_id_fkey;
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_learner_id_fkey;

ALTER TABLE sessions
  ADD CONSTRAINT sessions_mentor_id_fkey
    FOREIGN KEY (mentor_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE sessions
  ADD CONSTRAINT sessions_learner_id_fkey
    FOREIGN KEY (learner_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- feedback
ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_rater_id_fkey;
ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_ratee_id_fkey;

ALTER TABLE feedback
  ADD CONSTRAINT feedback_rater_id_fkey
    FOREIGN KEY (rater_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE feedback
  ADD CONSTRAINT feedback_ratee_id_fkey
    FOREIGN KEY (ratee_id) REFERENCES profiles(id) ON DELETE CASCADE;

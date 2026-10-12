/*
# Add Message Edit/Delete and Session Invitation Support

## Purpose
Extends the existing messages table to support WhatsApp-style message edit/delete
and session invitation messages shared from the Sessions page to Chat.

## Changes to existing `messages` table (all additive, no data loss)

1. `is_edited` (boolean, default false) — true when the sender has edited the message text
2. `edited_at` (timestamptz, nullable) — timestamp of the last edit
3. `is_deleted_for_everyone` (boolean, default false) — true when sender deleted for both parties
4. `deleted_for_user_ids` (uuid[], default '{}') — array of user IDs who deleted-for-me
5. `message_type` (text, default 'text') — 'text' for normal messages, 'session_invitation' for shared sessions
6. `session_invitation_data` (jsonb, nullable) — structured session info: {skill_name, session_date, session_time, meeting_url, learner_name}

## RLS Policy additions
- `messages_update_sender`: only the message sender can update (edit text, mark deleted-for-everyone)
- `messages_delete_sender`: only the sender can hard-delete (reserved for future use)

## Important notes
1. All existing messages get is_edited=false, is_deleted_for_everyone=false, message_type='text' — no behavior change
2. Delete-for-me is implemented via UPDATE (appending to deleted_for_user_ids), not row deletion
3. Delete-for-everyone sets is_deleted_for_everyone=true and clears content — row stays for placeholder display
4. Session invitations are inserted as regular messages with message_type='session_invitation'
5. Existing SELECT/INSERT policies are unchanged
*/

-- Add columns idempotently
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'is_edited') THEN
    ALTER TABLE public.messages ADD COLUMN is_edited boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'edited_at') THEN
    ALTER TABLE public.messages ADD COLUMN edited_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'is_deleted_for_everyone') THEN
    ALTER TABLE public.messages ADD COLUMN is_deleted_for_everyone boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'deleted_for_user_ids') THEN
    ALTER TABLE public.messages ADD COLUMN deleted_for_user_ids uuid[] NOT NULL DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'message_type') THEN
    ALTER TABLE public.messages ADD COLUMN message_type text NOT NULL DEFAULT 'text';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'session_invitation_data') THEN
    ALTER TABLE public.messages ADD COLUMN session_invitation_data jsonb;
  END IF;
END $$;

-- UPDATE policy: only sender can edit or delete their messages
DROP POLICY IF EXISTS "messages_update_sender" ON public.messages;
CREATE POLICY "messages_update_sender"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- DELETE policy: only sender can hard-delete (not currently used by app, but available)
DROP POLICY IF EXISTS "messages_delete_sender" ON public.messages;
CREATE POLICY "messages_delete_sender"
  ON public.messages FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);
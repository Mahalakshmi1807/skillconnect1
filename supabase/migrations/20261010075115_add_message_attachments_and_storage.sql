/*
# Add attachment support to messages table and create chat-attachments storage bucket

## Purpose
Support document attachments and voice messages in chat.

## Changes to messages table
- Add attachment_url (text, nullable) — path to file in Supabase Storage
- Add attachment_name (text, nullable) — original filename
- Add attachment_type (text, nullable) — mime type or 'voice'
- Make content nullable (voice messages may not have text content)

## New Storage Bucket
- Create 'chat-attachments' bucket for storing documents and voice recordings
- Policies: authenticated users can upload to their own folder, both conversation
  participants can read (we handle auth in the app layer via message ownership)

## Security
- RLS policies on storage.objects for the chat-attachments bucket
- Users can insert/delete objects they own
- Authenticated users can read objects (access controlled by app-level conversation checks)
*/

-- Add attachment columns to messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'attachment_url'
  ) THEN
    ALTER TABLE messages ADD COLUMN attachment_url text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'attachment_name'
  ) THEN
    ALTER TABLE messages ADD COLUMN attachment_name text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'attachment_type'
  ) THEN
    ALTER TABLE messages ADD COLUMN attachment_type text;
  END IF;
END $$;

-- Make content nullable for voice messages that have no text
ALTER TABLE messages ALTER COLUMN content DROP NOT NULL;

-- Create chat-attachments storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for chat-attachments bucket
DROP POLICY IF EXISTS "chat_attachments_read" ON storage.objects;
CREATE POLICY "chat_attachments_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "chat_attachments_insert" ON storage.objects;
CREATE POLICY "chat_attachments_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments' AND owner = auth.uid());

DROP POLICY IF EXISTS "chat_attachments_update" ON storage.objects;
CREATE POLICY "chat_attachments_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'chat-attachments' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'chat-attachments' AND owner = auth.uid());

DROP POLICY IF EXISTS "chat_attachments_delete" ON storage.objects;
CREATE POLICY "chat_attachments_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'chat-attachments' AND owner = auth.uid());

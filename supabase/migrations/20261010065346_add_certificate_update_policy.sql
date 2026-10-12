/*
# Add UPDATE policy to certificates table

1. Security Changes
   - Add UPDATE policy on certificates so learners can update their own certificate records
   - This is needed for the "mark completed" flow which updates an existing certificate
   - Without this, the UPDATE operation is blocked by RLS
*/

DROP POLICY IF EXISTS "certificates_update_own" ON certificates;
CREATE POLICY "certificates_update_own" ON certificates FOR UPDATE
  TO authenticated
  USING (auth.uid() = learner_id)
  WITH CHECK (auth.uid() = learner_id);

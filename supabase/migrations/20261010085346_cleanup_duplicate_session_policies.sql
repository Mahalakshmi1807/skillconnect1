/*
# Clean up duplicate session policies

The previous migration added new insert_sessions and update_sessions policies
that include admin role checks, but the original sessions_insert_parties and
sessions_update_parties policies still exist. Since RLS policies are OR'd,
the old restrictive policies don't block access, but they're redundant and
confusing. This migration drops the old policies to keep the set clean.
*/

DROP POLICY IF EXISTS "sessions_insert_parties" ON sessions;
DROP POLICY IF EXISTS "sessions_update_parties" ON sessions;

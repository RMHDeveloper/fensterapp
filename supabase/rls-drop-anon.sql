-- Fenster App — RLS cutover, step 2 of 2 (Phase C2)
-- Run this ONLY after the new frontend (real Supabase Auth login, this
-- session's Phase A changes) is deployed and confirmed working — dropping
-- these policies removes the anon-key-based access the CURRENTLY deployed
-- frontend still relies on. Running this before that deploy will lock
-- everyone out of the live app.
DROP POLICY IF EXISTS "Allow all for anon" ON fenster_projects;
DROP POLICY IF EXISTS "Allow all for anon" ON fenster_tasks;
DROP POLICY IF EXISTS "Allow all for anon" ON fenster_leads;
DROP POLICY IF EXISTS "Allow all for anon" ON fenster_payments;
DROP POLICY IF EXISTS "Allow all for anon" ON fenster_mistakes;
DROP POLICY IF EXISTS "Allow all for anon" ON fenster_managed_users;
DROP POLICY IF EXISTS "Allow all for anon" ON fenster_activity_logs;
DROP POLICY IF EXISTS "Allow all for anon" ON fenster_files;
DROP POLICY IF EXISTS "Allow all for anon" ON fenster_dashboard_targets;
DROP POLICY IF EXISTS "Allow all for anon" ON fenster_production;

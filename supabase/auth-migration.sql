-- Fenster App — Auth migration (Phase B)
-- Adds the columns needed to link Supabase Auth sessions to app users and to
-- scope leads/tasks by id instead of by display name. Safe to run multiple
-- times — every step is idempotent. Does not change any RLS policy; the
-- app keeps working exactly as it does today until Phase C is applied.
-- Run via: npm run db:auth-migration (see scripts/run-auth-migration.mjs)

-- ─── Link managed users to their Supabase Auth account ─────────────────────────
ALTER TABLE fenster_managed_users ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id);

-- ─── Leads: id-based ownership (replaces name-matching against data->>'assignee') ─
ALTER TABLE fenster_leads ADD COLUMN IF NOT EXISTS owner_id TEXT;

UPDATE fenster_leads l
SET owner_id = m.id
FROM fenster_managed_users m
WHERE l.owner_id IS NULL
  AND m.role = 'lead_manager'
  AND m.full_name = (l.data->>'assignee')
  -- only backfill when the name uniquely identifies one lead_manager
  AND (
    SELECT COUNT(*) FROM fenster_managed_users m2
    WHERE m2.role = 'lead_manager' AND m2.full_name = (l.data->>'assignee')
  ) = 1;

CREATE INDEX IF NOT EXISTS fenster_leads_owner_id_idx ON fenster_leads(owner_id);

-- ─── Tasks: id-based assignment (replaces name-matching against data->>'assignee') ─
ALTER TABLE fenster_tasks ADD COLUMN IF NOT EXISTS assignee_id TEXT;

UPDATE fenster_tasks t
SET assignee_id = m.id
FROM fenster_managed_users m
WHERE t.assignee_id IS NULL
  AND m.full_name = COALESCE(t.data->>'assignedTo', t.data->>'assignee')
  AND (
    SELECT COUNT(*) FROM fenster_managed_users m2
    WHERE m2.full_name = COALESCE(t.data->>'assignedTo', t.data->>'assignee')
  ) = 1;

CREATE INDEX IF NOT EXISTS fenster_tasks_assignee_id_idx ON fenster_tasks(assignee_id);

-- Note: fenster_projects.data->>'ownerId' already stores the lead_manager's
-- managed-user id (set at create time) — no schema change needed there.

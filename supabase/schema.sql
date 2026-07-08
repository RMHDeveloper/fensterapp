-- Fenster App — Supabase Schema
-- Run this in your Supabase SQL editor to create all required tables.
-- Enable Row Level Security (RLS) and add policies as needed.

-- ─── Projects ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fenster_projects (
  id            TEXT        PRIMARY KEY,
  name          TEXT        NOT NULL DEFAULT '',
  client        TEXT        NOT NULL DEFAULT '',
  current_stage TEXT        NOT NULL DEFAULT '',
  status        TEXT        NOT NULL DEFAULT 'active',
  data          JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE fenster_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON fenster_projects FOR ALL TO anon USING (true) WITH CHECK (true);

-- ─── Tasks ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fenster_tasks (
  id          TEXT        PRIMARY KEY,
  project_id  TEXT        NOT NULL DEFAULT '',
  flow_stage  TEXT        NOT NULL DEFAULT '',
  status      TEXT        NOT NULL DEFAULT 'pending',
  data        JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE fenster_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON fenster_tasks FOR ALL TO anon USING (true) WITH CHECK (true);

-- ─── Leads ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fenster_leads (
  id          TEXT        PRIMARY KEY,
  status      TEXT        NOT NULL DEFAULT 'new',
  data        JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE fenster_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON fenster_leads FOR ALL TO anon USING (true) WITH CHECK (true);

-- ─── Payments ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fenster_payments (
  id          TEXT        PRIMARY KEY,
  project_id  TEXT        NOT NULL DEFAULT '',
  status      TEXT        NOT NULL DEFAULT 'pending',
  data        JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE fenster_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON fenster_payments FOR ALL TO anon USING (true) WITH CHECK (true);

-- ─── Mistakes ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fenster_mistakes (
  id          TEXT        PRIMARY KEY,
  project_id  TEXT        NOT NULL DEFAULT '',
  status      TEXT        NOT NULL DEFAULT 'open',
  data        JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE fenster_mistakes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON fenster_mistakes FOR ALL TO anon USING (true) WITH CHECK (true);

-- ─── Managed Users ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fenster_managed_users (
  id          TEXT        PRIMARY KEY,
  email       TEXT        NOT NULL UNIQUE,
  full_name   TEXT        NOT NULL DEFAULT '',
  role        TEXT        NOT NULL DEFAULT 'viewer',
  status      TEXT        NOT NULL DEFAULT 'active',
  data        JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE fenster_managed_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON fenster_managed_users FOR ALL TO anon USING (true) WITH CHECK (true);

-- ─── Activity Logs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fenster_activity_logs (
  id              TEXT        PRIMARY KEY,
  project_id      TEXT,
  task_id         TEXT,
  action          TEXT        NOT NULL DEFAULT '',
  description     TEXT        NOT NULL DEFAULT '',
  data            JSONB       NOT NULL DEFAULT '{}',
  created_by      TEXT        NOT NULL DEFAULT '',
  created_by_role TEXT        NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE fenster_activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON fenster_activity_logs FOR ALL TO anon USING (true) WITH CHECK (true);

-- ─── Files (project files, docs, site photos, voice notes, quotation versions) ─
CREATE TABLE IF NOT EXISTS fenster_files (
  id          TEXT        PRIMARY KEY,
  project_id  TEXT        NOT NULL DEFAULT '',
  task_id     TEXT        NOT NULL DEFAULT '',
  category    TEXT        NOT NULL DEFAULT '',
  data        JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fenster_files_project_id_idx ON fenster_files(project_id);
CREATE INDEX IF NOT EXISTS fenster_files_category_idx ON fenster_files(category);
CREATE INDEX IF NOT EXISTS fenster_files_created_at_idx ON fenster_files(created_at DESC);
ALTER TABLE fenster_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON fenster_files FOR ALL TO anon USING (true) WITH CHECK (true);
-- `data` holds: { fileName, fileType, fileSize, url, uploadedBy, uploadedByRole, uploadedAt, versionNumber?, leadId?, metadata? }
-- category is one of: project_file, project_doc, site_photo, measurement_doc, voice_note,
--   quotation, job_sheet, glass_sheet, cutting_sheet, production_doc, installation_doc

-- ─── Dashboard Targets (single row, id = 'default') ────────────────────────────
CREATE TABLE IF NOT EXISTS fenster_dashboard_targets (
  id          TEXT        PRIMARY KEY,
  data        JSONB       NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE fenster_dashboard_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON fenster_dashboard_targets FOR ALL TO anon USING (true) WITH CHECK (true);
-- `data` holds: { daily: {ordersAmount, productionSqft, installationSqft, collectionAmount}, weekly: {...}, monthly: {...} }

-- ─── Realtime — enable for all tables ────────────────────────────────────────
-- Run in Supabase Dashboard → Database → Replication → enable for each table above,
-- or run these statements:
-- ALTER PUBLICATION supabase_realtime ADD TABLE fenster_projects;
-- ALTER PUBLICATION supabase_realtime ADD TABLE fenster_tasks;
-- ALTER PUBLICATION supabase_realtime ADD TABLE fenster_leads;
-- ALTER PUBLICATION supabase_realtime ADD TABLE fenster_payments;
-- ALTER PUBLICATION supabase_realtime ADD TABLE fenster_mistakes;
-- ALTER PUBLICATION supabase_realtime ADD TABLE fenster_managed_users;
-- ALTER PUBLICATION supabase_realtime ADD TABLE fenster_files;

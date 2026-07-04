import pg from 'pg'
const { Client } = pg

const sql = `
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
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='fenster_files' AND policyname='Allow all for anon'
  ) THEN
    CREATE POLICY "Allow all for anon" ON fenster_files FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE fenster_files;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
`

const client = new Client({
  connectionString: 'postgresql://postgres.ifpyxfrdphrzybxnvnwx:Fenster%40098%21%21@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false },
})

async function run() {
  await client.connect()
  console.log('Connected. Creating fenster_files table...')
  await client.query(sql)
  console.log('Done.')
  await client.end()
}

run().catch(err => { console.error(err.message); process.exit(1) })

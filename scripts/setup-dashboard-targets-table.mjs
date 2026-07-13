import pg from 'pg'
const { Client } = pg

const sql = `
CREATE TABLE IF NOT EXISTS fenster_dashboard_targets (
  id          TEXT        PRIMARY KEY,
  data        JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE fenster_dashboard_targets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='fenster_dashboard_targets' AND policyname='Allow all for anon'
  ) THEN
    CREATE POLICY "Allow all for anon" ON fenster_dashboard_targets FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE fenster_dashboard_targets;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
`

const connectionString = process.env.SUPABASE_DB_URL
if (!connectionString) {
  console.error('Set SUPABASE_DB_URL (Supabase project → Settings → Database → Connection string) before running this script.')
  process.exit(1)
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

async function run() {
  await client.connect()
  console.log('Connected. Creating fenster_dashboard_targets table...')
  await client.query(sql)
  console.log('Done.')
  await client.end()
}

run().catch(err => { console.error(err.message); process.exit(1) })

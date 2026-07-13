import pg from 'pg'
const { Client } = pg

const sql = `
CREATE TABLE IF NOT EXISTS fenster_production (
  id          TEXT        PRIMARY KEY,
  project_id  TEXT        NOT NULL DEFAULT '',
  stage       TEXT        NOT NULL DEFAULT 'cutting',
  status      TEXT        NOT NULL DEFAULT 'pending',
  data        JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE fenster_production ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='fenster_production' AND policyname='Allow all for anon'
  ) THEN
    CREATE POLICY "Allow all for anon" ON fenster_production FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;
ALTER PUBLICATION supabase_realtime ADD TABLE fenster_production;
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
  console.log('Connected. Creating fenster_production table...')
  await client.query(sql)
  console.log('Done.')
  await client.end()
}

run().catch(err => { console.error(err.message); process.exit(1) })

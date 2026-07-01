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

const client = new Client({
  connectionString: 'postgresql://postgres.ifpyxfrdphrzybxnvnwx:Fenster%40098%21%21@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres',
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

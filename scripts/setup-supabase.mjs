import pg from 'pg'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const { Client } = pg

const __dir = dirname(fileURLToPath(import.meta.url))
const schema = readFileSync(join(__dir, '../supabase/schema.sql'), 'utf8')

const realtimeSQL = `
ALTER PUBLICATION supabase_realtime ADD TABLE fenster_projects;
ALTER PUBLICATION supabase_realtime ADD TABLE fenster_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE fenster_leads;
ALTER PUBLICATION supabase_realtime ADD TABLE fenster_payments;
ALTER PUBLICATION supabase_realtime ADD TABLE fenster_mistakes;
ALTER PUBLICATION supabase_realtime ADD TABLE fenster_managed_users;
`

const client = new Client({
  connectionString: 'postgresql://postgres.ifpyxfrdphrzybxnvnwx:Fenster%40098%21%21@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false },
})

async function run() {
  console.log('Connecting to Supabase...')
  await client.connect()
  console.log('Connected.')

  console.log('\nCreating tables...')
  await client.query(schema)
  console.log('Tables created.')

  console.log('\nEnabling realtime...')
  for (const stmt of realtimeSQL.split(';').map(s => s.trim()).filter(Boolean)) {
    try {
      await client.query(stmt)
      console.log(' ✓', stmt.slice(0, 60))
    } catch (err) {
      if (err.message.includes('already member')) {
        console.log(' ~ already enabled:', stmt.slice(0, 60))
      } else {
        console.warn(' ! warning:', err.message)
      }
    }
  }

  await client.end()
  console.log('\nDone! Supabase is ready.')
}

run().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})

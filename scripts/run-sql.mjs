// Generic runner for one-off SQL migration files in supabase/*.sql.
// Usage: node scripts/run-sql.mjs supabase/some-file.sql
import pg from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'

const { Client } = pg

const relPath = process.argv[2]
if (!relPath) {
  console.error('Usage: node scripts/run-sql.mjs <path-to-sql-file>')
  process.exit(1)
}

const connectionString = process.env.SUPABASE_DB_URL
if (!connectionString) {
  console.error('Set SUPABASE_DB_URL (Supabase project → Settings → Database → Connection string) before running this script.')
  process.exit(1)
}

const sql = readFileSync(join(process.cwd(), relPath), 'utf8')
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })

async function run() {
  console.log(`Connecting to Supabase...`)
  await client.connect()
  console.log(`Connected. Applying ${relPath}...`)
  await client.query(sql)
  console.log('Done.')
  await client.end()
}

run().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})

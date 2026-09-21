import pg from 'pg';
const { Client } = pg;

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL (Supabase connection string) before running this script');
const client = new Client({
  connectionString: process.env.DATABASE_URL
});

await client.connect();

const sql = `CREATE TABLE IF NOT EXISTS cc_agents (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
)`;

const idx = `CREATE INDEX IF NOT EXISTS idx_cc_agents_name ON cc_agents(name)`;

try {
  const r1 = await client.query(sql);
  console.log('cc_agents:', r1.command);
  const r2 = await client.query(idx);
  console.log('idx_cc_agents_name:', r2.command);
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await client.end();
}

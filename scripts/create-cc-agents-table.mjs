import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres:***REMOVED***@db.crreoeautoqzcgtlwlsd.supabase.co:5432/postgres'
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

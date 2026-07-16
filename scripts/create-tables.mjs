import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres:Singh%40%23654321@db.crreoeautoqzcgtlwlsd.supabase.co:5432/postgres'
});

await client.connect();

const sql1 = `CREATE TABLE IF NOT EXISTS auth_activities (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT DEFAULT 'main-dashboard',
  username TEXT DEFAULT 'User',
  action TEXT DEFAULT 'view',
  page TEXT DEFAULT '',
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
)`;

const sql2 = `CREATE TABLE IF NOT EXISTS call_logs (
  id BIGSERIAL PRIMARY KEY,
  policyno TEXT,
  vinno TEXT,
  customer_name TEXT,
  model TEXT,
  insurancecompany TEXT,
  grosspremium NUMERIC,
  policy_expiry_date TEXT,
  mobile_no TEXT,
  call_date TIMESTAMPTZ DEFAULT NOW(),
  call_outcome TEXT NOT NULL,
  remarks TEXT,
  follow_up_date DATE,
  agent_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
)`;

const sql3 = `CREATE INDEX IF NOT EXISTS idx_call_logs_policyno ON call_logs(policyno)`;
const sql4 = `CREATE INDEX IF NOT EXISTS idx_call_logs_call_date ON call_logs(call_date DESC)`;
const sql5 = `CREATE INDEX IF NOT EXISTS idx_auth_activities_created_at ON auth_activities(created_at DESC)`;

try {
  const r1 = await client.query(sql1);
  console.log('auth_activities:', r1.command);
  const r2 = await client.query(sql2);
  console.log('call_logs:', r2.command);
  const r3 = await client.query(sql3);
  console.log('idx_call_logs_policyno:', r3.command);
  const r4 = await client.query(sql4);
  console.log('idx_call_logs_call_date:', r4.command);
  const r5 = await client.query(sql5);
  console.log('idx_auth_activities_created_at:', r5.command);
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await client.end();
}

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').replace(/\r/g, '');
const u = env.match(/NEXT_PUBLIC_SUPABASE_URL="([^"]+)"/)[1];
const k = env.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)[1];
const sb = createClient(u.trim(), k.trim());

async function main() {
  const { data, error } = await sb.from('kia_insurance').select('*').limit(5);
  if (error) { console.error(error); return; }
  console.log('Columns:', Object.keys(data[0]).join(', '));
  data.forEach(r => {
    console.log('---');
    console.log('create_date:', r.create_date, typeof r.create_date);
    console.log('policytype:', r.policytype);
    console.log('vinno:', r.vinno);
    console.log('policy_expiry_date:', r.policy_expiry_date, typeof r.policy_expiry_date);
    console.log('policy_effective_date:', r.policy_effective_date, typeof r.policy_effective_date);
  });
}
main();

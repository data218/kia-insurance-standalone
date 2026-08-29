const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').replace(/\r/g, '');
const u = env.match(/NEXT_PUBLIC_SUPABASE_URL="([^"]+)"/)[1];
const k = env.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)[1];
const sb = createClient(u.trim(), k.trim());
sb.from('kia_insurance').select('create_date,policytype,vinno').limit(3).then(({data, e}) => {
  if (e) console.error(e);
  else data.forEach(r => console.log(typeof r.create_date, r.create_date, r.policytype, r.vinno));
});

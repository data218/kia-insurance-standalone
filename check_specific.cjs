const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').replace(/\r/g, '');
const u = env.match(/NEXT_PUBLIC_SUPABASE_URL="([^"]+)"/)[1];
const k = env.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)[1];
const sb = createClient(u.trim(), k.trim());

async function main() {
  // Check specific VIN
  const vin = 'MZBGB814LSN256022';
  const { data, error } = await sb.from('kia_insurance').select('create_date, policytype, vinno, policy_expiry_date')
    .eq('vinno', vin)
    .neq('cancelled', 'Yes');
  if (error) { console.error(error); return; }
  console.log('Records for VIN', vin);
  data.forEach(r => console.log('  ' + r.create_date + ' | ' + r.policytype + ' | ' + r.vinno + ' | expiry=' + r.policy_expiry_date));
  
  // Now check a random LY New VIN
  const { data: d2 } = await sb.from('kia_insurance').select('create_date, policytype, vinno')
    .eq('policytype', 'New')
    .gte('create_date', '2025-01-01')
    .lt('create_date', '2026-01-01')
    .neq('cancelled', 'Yes')
    .limit(5);
  console.log('\nSample LY New records:');
  d2.forEach(r => console.log('  ' + r.create_date + ' | ' + r.policytype + ' | ' + r.vinno));
  
  // Check a random CY Renewal VIN
  const { data: d3 } = await sb.from('kia_insurance').select('create_date, policytype, vinno')
    .eq('policytype', 'Renewal')
    .gte('create_date', '2026-01-01')
    .lt('create_date', '2027-01-01')
    .neq('cancelled', 'Yes')
    .limit(5);
  console.log('\nSample CY Renewal records:');
  d3.forEach(r => console.log('  ' + r.create_date + ' | ' + r.policytype + ' | ' + r.vinno));
  
  // Query: find VINs that have BOTH LY New AND CY Renewal
  const { data: lyNew } = await sb.from('kia_insurance').select('vinno')
    .eq('policytype', 'New')
    .gte('create_date', '2025-01-01')
    .lt('create_date', '2026-01-01')
    .neq('cancelled', 'Yes')
    .neq('vinno', null);
  
  const lyNewVins = new Set(lyNew.map(r => r.vinno));
  console.log('\nLY New unique VINs count:', lyNewVins.size);
  
  const { data: cyRen } = await sb.from('kia_insurance').select('vinno')
    .eq('policytype', 'Renewal')
    .gte('create_date', '2026-01-01')
    .lt('create_date', '2027-01-01')
    .neq('cancelled', 'Yes')
    .neq('vinno', null);
  
  const cyRenVins = new Set(cyRen.map(r => r.vinno));
  console.log('CY Renewal unique VINs count:', cyRenVins.size);
  
  const overlap = [...lyNewVins].filter(v => cyRenVins.has(v));
  console.log('Overlap count:', overlap.length);
  if (overlap.length > 0) {
    console.log('Some overlapping VINs:', overlap.slice(0, 5));
  }
}
main();

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8').replace(/\r/g, '');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL="([^"]+)"/);
const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/);
if (!urlMatch || !keyMatch) { console.error('Missing env vars'); process.exit(1); }
const sb = createClient(urlMatch[1].trim(), keyMatch[1].trim());

// Dashboard's parseDate logic
function parseDate(s) {
  if(!s) return null;
  s = String(s).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return {year: parseInt(m[1]), month: parseInt(m[2]), day: parseInt(m[3])};
  m = s.match(/^(\d{4})-(\d{2})$/);
  if(m) return {year: parseInt(m[1]), month: parseInt(m[2]), day: 1};
  m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if(m) {
    let months = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
    return {year: parseInt(m[3]), month: months[m[2].toLowerCase()] || NaN, day: parseInt(m[1])};
  }
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if(m) return {year: parseInt(m[3]), month: parseInt(m[2]), day: parseInt(m[1])};
  return null;
}
function getMonth(s) { let d = parseDate(s); return d ? d.month : NaN; }
function getYear(s) { let d = parseDate(s); return d ? d.year : NaN; }

async function main() {
  // Need all rows - use multiple queries or increase limit
  // Since Supabase free tier limits, let's use a range filter
  const ly = 2025, cy = 2026;
  
  // Get ALL rows by querying year ranges
  const allData = [];
  for (let year of [2025, 2026]) {
    const { data, error } = await sb.from('kia_insurance')
      .select('*')
      .gte('create_date', year + '-01-01')
      .lt('create_date', (year + 1) + '-01-01');
    if (error) { console.error(error); return; }
    allData.push(...data);
  }
  console.log('Total rows fetched:', allData.length);
  
  const valid = allData.filter(r => r.vinno && r.create_date && r.cancelled !== 'Yes');
  
  // Build LY New expiry months
  const vinExpiryMonth = {};
  valid.forEach(r => {
    if (!r.vinno || r.policytype !== 'New') return;
    if (getYear(r.create_date) !== ly) return;
    const month = getMonth(r.create_date);
    const expMonth = getMonth(r.policy_expiry_date) || getMonth(r.policy_effective_date) || month;
    vinExpiryMonth[r.vinno] = expMonth;
  });
  
  // CY Renewal VINs
  const cyRenewalVins = new Set();
  valid.forEach(r => {
    if (!r.vinno || r.policytype !== 'Renewal' || r.cancelled === 'Yes') return;
    if (getYear(r.create_date) === cy) cyRenewalVins.add(r.vinno);
  });
  
  console.log('LY New VINs with expiry:', Object.keys(vinExpiryMonth).length);
  console.log('CY Renewal VINs:', cyRenewalVins.size);
  
  const allLyNewVins = new Set(Object.keys(vinExpiryMonth));
  const cyRenewalByExpiry = {};
  
  allLyNewVins.forEach(vin => {
    const expMonth = vinExpiryMonth[vin];
    if (!expMonth || !cyRenewalVins.has(vin)) return;
    const ym = cy + '-' + String(expMonth).padStart(2, '0');
    if (!cyRenewalByExpiry[ym]) cyRenewalByExpiry[ym] = new Set();
    cyRenewalByExpiry[ym].add(vin);
  });
  
  console.log('\n=== Renewal CY by expiry month ===');
  const total = Object.keys(cyRenewalByExpiry).sort().reduce((sum, k) => {
    console.log(k + ': ' + cyRenewalByExpiry[k].size);
    return sum + cyRenewalByExpiry[k].size;
  }, 0);
  console.log('Total mapped:', total);
  
  // Show Jul/Aug details
  ['2026-07', '2026-08'].forEach(ym => {
    const vins = cyRenewalByExpiry[ym] || new Set();
    console.log('\n' + ym + ' (' + vins.size + '):');
    vins.forEach(v => {
      const r = valid.find(x => x.vinno === v && x.policytype === 'New' && getYear(x.create_date) === ly);
      console.log('  ' + v + ' | expiry=' + (r ? r.policy_expiry_date : '?') + ' | expMonth=' + vinExpiryMonth[v]);
    });
  });
  
  // Now check: which LY New VINs with expiry 7 or 8 are also in CY Renewal?
  console.log('\n=== LY New VINs with expiry Jul/Aug that have CY Renewal ===');
  allLyNewVins.forEach(vin => {
    const expMonth = vinExpiryMonth[vin];
    if ((expMonth === 7 || expMonth === 8) && cyRenewalVins.has(vin)) {
      const r = valid.find(x => x.vinno === vin && x.policytype === 'New' && getYear(x.create_date) === ly);
      console.log(vin + ' | expiry=' + (r ? r.policy_expiry_date : '?') + ' | expMonth=' + expMonth);
    }
  });
  
  // Count ALL CY Renewal-type VINs by create_date month (regardless of LY match)
  console.log('\n=== ALL CY Renewal-type VINs by create_date month ===');
  const cyRenByCreate = {};
  valid.forEach(r => {
    if (!r.vinno || r.policytype !== 'Renewal' || r.cancelled === 'Yes') return;
    if (getYear(r.create_date) !== cy) return;
    const mo = getMonth(r.create_date);
    const ym = cy + '-' + String(mo).padStart(2, '0');
    if (!cyRenByCreate[ym]) cyRenByCreate[ym] = new Set();
    cyRenByCreate[ym].add(r.vinno);
  });
  Object.keys(cyRenByCreate).sort().forEach(k => {
    console.log(k + ': ' + cyRenByCreate[k].size + ' total Renewal VINs | Renewal CY: ' + (cyRenewalByExpiry[k] ? cyRenewalByExpiry[k].size : 0) + ' | Diff: ' + (cyRenByCreate[k].size - (cyRenewalByExpiry[k] ? cyRenewalByExpiry[k].size : 0)));
  });
  
  // Specifically for July and August, show the VINs that are NOT in Renewal CY
  ['2026-07', '2026-08'].forEach(ym => {
    const totalVins = cyRenByCreate[ym] || new Set();
    const renewalVins = cyRenewalByExpiry[ym] || new Set();
    const diff = [...totalVins].filter(v => !renewalVins.has(v));
    console.log('\n' + ym + ' - VINs NOT in Renewal CY (count=' + diff.length + '):');
    diff.forEach(v => {
      const lyRec = valid.find(x => x.vinno === v && x.policytype === 'New' && getYear(x.create_date) === ly);
      console.log('  ' + v + ' | hasLYNew=' + (lyRec ? 'yes' : 'no') + ' | expMonth=' + (vinExpiryMonth[v] || 'N/A'));
    });
  });
  
  // Check all create_date months present in the data
  console.log('\n=== All create_date months in data ===');
  const months = new Set();
  valid.forEach(r => {
    if (r.create_date) months.add(r.create_date.substring(0, 7));
  });
  console.log([...months].sort().join(', '));
  
  // Also count by create_date month for ALL policy types
  console.log('\n=== All records by create_date month ===');
  const allByMonth = {};
  valid.forEach(r => {
    const ym = r.create_date.substring(0, 7);
    allByMonth[ym] = (allByMonth[ym] || 0) + 1;
  });
  Object.keys(allByMonth).sort().forEach(k => console.log(k + ': ' + allByMonth[k]));
}
main().catch(console.error);

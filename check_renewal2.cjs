const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8').replace(/\r/g, '');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL="([^"]+)"/);
const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/);
if (!urlMatch || !keyMatch) { console.error('Missing env vars'); process.exit(1); }
const sb = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function main() {
  const { data, error } = await sb.from('kia_insurance').select('*').order('create_date', { ascending: false });
  if (error) { console.error(error); process.exit(1); }
  
  const ly = 2025, cy = 2026;
  const valid = data.filter(r => r.vinno && r.create_date && r.cancelled !== 'Yes');
  
  // Dashboard's parseDate function (exact copy)
  function parseDate(s) {
    if (!s) return null;
    s = String(s).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return { year: parseInt(m[1]), month: parseInt(m[2]), day: parseInt(m[3]) };
    m = s.match(/^(\d{4})-(\d{2})$/);
    if (m) return { year: parseInt(m[1]), month: parseInt(m[2]), day: 1 };
    m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    if (m) {
      var months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
      return { year: parseInt(m[3]), month: months[m[2].toLowerCase()] || NaN, day: parseInt(m[1]) };
    }
    m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (m) return { year: parseInt(m[3]), month: parseInt(m[2]), day: parseInt(m[1]) };
    return null;
  }
  function getMonth(s) { var d = parseDate(s); return d ? d.month : NaN; }
  function getYear(s) { var d = parseDate(s); return d ? d.year : NaN; }
  
  // LY New by VIN with all the fields needed
  const lyNewByVIN = {};
  valid.filter(r => {
    const y = getYear(r.create_date);
    return y === ly && r.policytype === 'New' && r.vinno;
  }).forEach(r => {
    if (!lyNewByVIN[r.vinno]) lyNewByVIN[r.vinno] = [];
    lyNewByVIN[r.vinno].push(r);
  });
  
  // CY Renewal records
  const cyRenewals = valid.filter(r => {
    const y = getYear(r.create_date);
    return y === cy && r.policytype === 'Renewal' && r.vinno;
  });
  
  // Build vinExpiryMonth exactly like dashboard
  const vinExpiryMonth = {};
  valid.forEach(r => {
    if (!r.vinno || r.policytype !== 'New') return;
    if (getYear(r.create_date) !== ly) return;
    const month = getMonth(r.create_date);
    const expMonth = getMonth(r.policy_expiry_date) || getMonth(r.policy_effective_date) || month;
    vinExpiryMonth[r.vinno] = expMonth;
  });
  
  const cyRenewalVins = new Set(cyRenewals.map(r => r.vinno));
  
  // Debug info after all init
  console.log('=== Create date type check ===');
  console.log('First row create_date:', data[0].create_date, 'type:', typeof data[0].create_date);
  console.log('lyNewByVIN keys count:', Object.keys(lyNewByVIN).length);
  console.log('cyRenewals count:', cyRenewals.length);
  console.log('cyRenewalVins count:', cyRenewalVins.size);
  console.log('vinExpiryMonth count:', Object.keys(vinExpiryMonth).length);
  
  // Check expiry date format for sample
  console.log('\n=== Expiry date format samples ===');
  Object.keys(lyNewByVIN).slice(0, 10).forEach(vin => {
    const r = lyNewByVIN[vin][0];
    const expDate = r.policy_expiry_date;
    console.log('VIN: ' + vin + ' | policy_expiry_date: "' + expDate + '" | getMonth: ' + getMonth(expDate) + ' | vinExpiryMonth: ' + vinExpiryMonth[vin]);
  });
  
  // Build cyRenewalByExpiry
  const cyRenewalByExpiry = {};
  const allLyNewVins = new Set(Object.keys(lyNewByVIN));
  console.log('\nallLyNewVins count:', allLyNewVins.size);
  console.log('CY Renewal VINs that are also in allLyNewVins: ' + [...cyRenewalVins].filter(v => allLyNewVins.has(v)).length);
  
  let mapped = 0;
  allLyNewVins.forEach(vin => {
    const expMonth = vinExpiryMonth[vin];
    if (!expMonth || !cyRenewalVins.has(vin)) {
      if (cyRenewalVins.has(vin) && !expMonth) {
        const r = lyNewByVIN[vin][0];
        console.log('VIN in cyRenewal but no expMonth: ' + vin + ' | expiry=' + r.policy_expiry_date + ' | getMonth=' + getMonth(r.policy_expiry_date));
      }
      return;
    }
    mapped++;
    const ym = cy + '-' + String(expMonth).padStart(2, '0');
    if (!cyRenewalByExpiry[ym]) cyRenewalByExpiry[ym] = new Set();
    cyRenewalByExpiry[ym].add(vin);
  });
  console.log('Mapped into cyRenewalByExpiry:', mapped);
  
  console.log('\n=== Renewal CY by expiry month (dashboard logic) ===');
  Object.keys(cyRenewalByExpiry).sort().forEach(k => {
    console.log(k + ': ' + cyRenewalByExpiry[k].size);
  });
  
  console.log('\nJuly: ' + (cyRenewalByExpiry['2026-07'] ? cyRenewalByExpiry['2026-07'].size : 0));
  console.log('Aug: ' + (cyRenewalByExpiry['2026-08'] ? cyRenewalByExpiry['2026-08'].size : 0));
  
  // Show VINs in cyRenewalByExpiry for Jul/Aug
  Object.keys(cyRenewalByExpiry).sort().forEach(k => {
    if (k === '2026-07' || k === '2026-08') {
      console.log('\n' + k + ' VINs:');
      cyRenewalByExpiry[k].forEach(v => {
        const r = lyNewByVIN[v][0];
        console.log('  ' + v + ' | expiry=' + r.policy_expiry_date);
      });
    }
  });
}
main().catch(console.error);

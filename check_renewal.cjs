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
  
  // LY New by VIN with expiry months
  const lyNewByVIN = {};
  valid.filter(r => {
    const y = parseInt(r.create_date.substring(0,4));
    return y === ly && r.policytype === 'New' && r.vinno;
  }).forEach(r => {
    if (!lyNewByVIN[r.vinno]) lyNewByVIN[r.vinno] = [];
    lyNewByVIN[r.vinno].push(r);
  });
  
  // CY Renewal records
  const cyRenewals = valid.filter(r => {
    const y = parseInt(r.create_date.substring(0,4));
    return y === cy && r.policytype === 'Renewal' && r.vinno;
  });
  
  // Build vinExpiryMonth like the dashboard
  const vinExpiryMonth = {};
  valid.forEach(r => {
    if (!r.vinno || r.policytype !== 'New') return;
    const y = parseInt(r.create_date.substring(0,4));
    if (y !== ly) return;
    const month = parseInt(r.create_date.substring(5,7));
    let expMonth = null;
    if (r.policy_expiry_date) {
      const parts = r.policy_expiry_date.split(/[/-]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) expMonth = parseInt(parts[1]);
        else expMonth = parseInt(parts[1]);
      }
    }
    if (!expMonth && r.policy_effective_date) {
      const parts = r.policy_effective_date.split(/[/-]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) expMonth = parseInt(parts[1]);
        else expMonth = parseInt(parts[1]);
      }
    }
    if (!expMonth) expMonth = month;
    vinExpiryMonth[r.vinno] = expMonth;
  });
  
  const cyRenewalVins = new Set(cyRenewals.map(r => r.vinno));
  
  // Build cyRenewalByExpiry
  const cyRenewalByExpiry = {};
  Object.keys(lyNewByVIN).forEach(vin => {
    const expMonth = vinExpiryMonth[vin];
    if (!expMonth || !cyRenewalVins.has(vin)) return;
    const ym = cy + '-' + String(expMonth).padStart(2, '0');
    if (!cyRenewalByExpiry[ym]) cyRenewalByExpiry[ym] = new Set();
    cyRenewalByExpiry[ym].add(vin);
  });
  
  console.log('=== Renewal CY by expiry month ===');
  Object.keys(cyRenewalByExpiry).sort().forEach(k => {
    console.log(k + ' TOTAL: ' + cyRenewalByExpiry[k].size);
    cyRenewalByExpiry[k].forEach(v => {
      const lyRec = lyNewByVIN[v][0];
      console.log('  ' + v + ' | create=' + lyRec.create_date + ' | expiry=' + lyRec.policy_expiry_date + ' | effective=' + lyRec.policy_effective_date);
    });
  });
  
  // All CY Renewal with LY details
  console.log('\n=== All CY Renewal VINs with LY details ===');
  cyRenewals.forEach(r => {
    const vin = r.vinno;
    const lyRecs = lyNewByVIN[vin];
    if (lyRecs && lyRecs.length > 0) {
      const lr = lyRecs[0];
      const expMonth = vinExpiryMonth[vin];
      console.log(r.create_date.substring(0,7) + ' | ' + vin + ' | ' + r.insurancecompany + ' | expiryMonth=' + expMonth + ' | LY create=' + lr.create_date + ' | LY expiry=' + lr.policy_expiry_date);
    } else {
      console.log(r.create_date.substring(0,7) + ' | ' + vin + ' | ' + r.insurancecompany + ' | NO LY New record');
    }
  });
}
main().catch(console.error);

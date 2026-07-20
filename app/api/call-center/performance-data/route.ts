import { NextResponse } from 'next/server'
import { fetchAll } from '@/lib/kia-insurance/supabase'
import { checkCookie, validateToken } from '@/lib/kia-insurance/auth'

export const dynamic = 'force-dynamic'

function authenticate(req: Request): boolean {
  if (checkCookie(req).valid) return true
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (token && validateToken(token).valid) return true
  return false
}

export async function GET(req: Request) {
  try {
    if (!authenticate(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let insurance: any[] = []
    let logs: any[] = []
    try { insurance = await fetchAll('kia_insurance') } catch (_) {}
    try { logs = await fetchAll('call_logs') } catch (_) {}

    const insuranceReduced = insurance
      .filter((r: any) => r.cancelled !== 'Yes')
      .map((r: any) => ({
        policyno: r.policyno || '',
        vinno: r.vinno || '',
        customer_name: r.customer_name || '',
        model: r.model || '',
        insurancecompany: r.insurancecompany || '',
        grosspremium: Number(r.grosspremium) || 0,
        policytype: r.policytype || null,
        is_new: r.is_new || null,
        create_date: r.create_date || '',
        policy_expiry_date: r.policy_expiry_date || '',
        source: r.source || 'kia_safety',
      }))

    const logsReduced = logs.map((l: any) => ({
      policyno: l.policyno || '',
      vinno: l.vinno || '',
      customer_name: l.customer_name || '',
      model: l.model || '',
      insurancecompany: l.insurancecompany || '',
      grosspremium: Number(l.grosspremium) || 0,
      call_outcome: l.call_outcome || '',
      call_date: l.call_date || '',
      agent_name: l.agent_name || '',
      mobile_no: l.mobile_no || '',
      remarks: l.remarks || '',
      follow_up_date: l.follow_up_date || null,
      policy_expiry_date: l.policy_expiry_date || '',
    }))

    return NextResponse.json({ insurance: insuranceReduced, logs: logsReduced })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

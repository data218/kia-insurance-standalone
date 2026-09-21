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

function parsePortalDate(val: string): string {
  if (!val || !val.trim()) return ''
  const v = val.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const m: Record<string,string> = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'}
  const match = v.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/)
  if (match) {
    const mon = m[match[2].toLowerCase()]
    if (mon) return `${match[3]}-${mon}-${String(parseInt(match[1])).padStart(2,'0')}`
  }
  const parts = v.split('/')
  if (parts.length === 3) {
    if (/^\d{4}$/.test(parts[0])) return v
    if (/^\d{4}$/.test(parts[2])) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
  }
  return v
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
        netodpremiuma: Number(r.netodpremiuma) || 0,
        totalidv: Number(r.totalidv) || 0,
        policytype: r.policytype || null,
        is_new: r.policytype === 'New' ? 'Yes' : 'No',
        create_date: parsePortalDate(r.create_date),
        policy_expiry_date: parsePortalDate(r.policy_expiry_date),
        source: r.source || 'kia_safety',
      }))

    const vinLookup: Record<string, any> = {}
    for (const r of insuranceReduced) {
      if (r.vinno) {
        if (!vinLookup[r.vinno] || r.create_date > vinLookup[r.vinno]._create_date) {
          vinLookup[r.vinno] = {
            totalidv: r.totalidv,
            netodpremiuma: r.netodpremiuma,
            policytype: r.policytype,
            insurancecompany: r.insurancecompany,
            model: r.model,
            customer_name: r.customer_name,
            policyno: r.policyno,
            _create_date: r.create_date,
          }
        }
      }
    }

    const polLookup: Record<string, any> = {}
    for (const r of insuranceReduced) {
      if (r.policyno) {
        if (!polLookup[r.policyno] || r.create_date > polLookup[r.policyno]._create_date) {
          polLookup[r.policyno] = {
            totalidv: r.totalidv,
            netodpremiuma: r.netodpremiuma,
            policytype: r.policytype,
            insurancecompany: r.insurancecompany,
            model: r.model,
            customer_name: r.customer_name,
            _create_date: r.create_date,
          }
        }
      }
    }

    const logVins = new Set(logs.filter((l: any) => l.vinno).map((l: any) => l.vinno))
    const insuranceMatched = insuranceReduced.filter((r: any) => logVins.has(r.vinno))

    const logsReduced = logs.map((l: any) => {
      const ins = (l.vinno && vinLookup[l.vinno]) || (l.policyno && polLookup[l.policyno])
      return {
        policyno: l.policyno || ins?.policyno || '',
        vinno: l.vinno || '',
        customer_name: l.customer_name || ins?.customer_name || '',
        model: l.model || ins?.model || '',
        insurancecompany: l.insurancecompany || ins?.insurancecompany || '',
        netodpremiuma: Number(l.netodpremiuma) || ins?.netodpremiuma || 0,
        totalidv: ins?.totalidv || 0,
        policytype: ins?.policytype || null,
        call_outcome: l.call_outcome || '',
        call_date: parsePortalDate(l.call_date),
        agent_name: l.agent_name || '',
        mobile_no: l.mobile_no || '',
        remarks: l.remarks || '',
        follow_up_date: l.follow_up_date ? parsePortalDate(l.follow_up_date) : null,
        policy_expiry_date: parsePortalDate(l.policy_expiry_date),
      }
    })

    return NextResponse.json({ insurance: insuranceMatched, logs: logsReduced })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

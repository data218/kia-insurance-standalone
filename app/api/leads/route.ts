import { NextResponse } from 'next/server'
import { fetchAll } from '@/lib/kia-insurance/supabase'
import { sanitizeRemarks } from '@/lib/kia-insurance/utils'
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

    const rows = await fetchAll('kia_insurance_form_data')

    let allLogs: any[] = []
    try { allLogs = await fetchAll('call_logs') } catch (_) {}
    const logMap: Record<string, any> = {}
    const logCount: Record<string, number> = {}
    const logsByPolicy: Record<string, any[]> = {}
    const logKeys = (log: any): string[] => {
      const keys: string[] = []
      if (log.policyno) keys.push(String(log.policyno).trim())
      if (log.vinno) keys.push('v:' + String(log.vinno).trim().toUpperCase())
      if (log.mobile_no) keys.push('m:' + String(log.mobile_no).trim())
      return keys
    }
    for (const log of allLogs) {
      for (const key of logKeys(log)) {
        if (!logMap[key] || log.call_date > logMap[key].call_date) logMap[key] = log
        logCount[key] = (logCount[key] || 0) + 1
        if (!logsByPolicy[key]) logsByPolicy[key] = []
        logsByPolicy[key].push(log)
      }
    }
    for (const key of Object.keys(logsByPolicy)) {
      logsByPolicy[key].sort((a: any, b: any) => new Date(b.call_date).getTime() - new Date(a.call_date).getTime())
    }

    rows.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())

    const leads = rows.map((r: any) => {
      const pno = r.policyno || ''
      const leadKeys = [
        pno ? String(pno).trim() : '',
        r.vinno ? 'v:' + String(r.vinno).trim().toUpperCase() : '',
        r.mobile_no ? 'm:' + String(r.mobile_no).trim() : '',
      ].filter(Boolean)
      let lastLog: any = null
      let leadLogs: any[] = []
      for (const key of leadKeys) {
        const m = logMap[key]
        if (m && (!lastLog || m.call_date > lastLog.call_date)) lastLog = m
        leadLogs = leadLogs.concat(logsByPolicy[key] || [])
      }
      const seen = new Set<number>()
      const uniqueLogs = leadLogs.filter((l: any) => {
        if (seen.has(l.id)) return false
        seen.add(l.id)
        return true
      })
      uniqueLogs.sort((a: any, b: any) => new Date(b.call_date).getTime() - new Date(a.call_date).getTime())
      const history = uniqueLogs.map((l: any) => ({
        outcome: l.call_outcome, date: l.call_date,
        agent: l.agent_name, remarks: l.remarks, follow_up: l.follow_up_date,
      }))
      return {
        id: r.id,
        policyno: pno,
        vinno: r.vinno || '',
        reg_no: r.reg_no || '',
        customer_name: r.customer_name || '-',
        model: r.model || '-',
        insurancecompany: r.insurancecompany || '-',
        policy_expiry_date: r.policy_expiry_date || '',
        mobile_no: r.mobile_no || '',
        remarks: r.remarks || '',
        lead_source: r.lead_source || '',
        source_agent: r.source_agent || '',
        follow_up_date: r.follow_up_date || null,
        created_at: r.created_at || '',
        call_status: lastLog ? lastLog.call_outcome : 'Pending',
        last_call_date: lastLog ? lastLog.call_date : null,
        last_remarks: lastLog ? sanitizeRemarks(lastLog.remarks || '') : '',
        last_agent: lastLog ? lastLog.agent_name : '',
        attempt_count: seen.size,
        history,
      }
    })

    return NextResponse.json({ leads, total: leads.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

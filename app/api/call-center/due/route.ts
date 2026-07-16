import { NextResponse } from 'next/server'
import { fetchAll } from '@/lib/kia-insurance/supabase'
import { extractMobileFromRemarks, sanitizeRemarks } from '@/lib/kia-insurance/utils'
import { checkCookie, validateToken } from '@/lib/kia-insurance/auth'

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
  return ''
}

function authenticate(req: Request): boolean {
  if (checkCookie(req).valid) return true
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (token && validateToken(token).valid) return true
  return false
}

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    if (!authenticate(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') || (() => {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })()
    const rows = await fetchAll('kia_insurance')
    const [selYear, selMonth] = month.split('-').map(Number)
    const lastYear = selYear - 1
    const lastYearMonthPrefix = `${lastYear}-${String(selMonth).padStart(2, '0')}`

    const vinNewestDate: Record<string, string> = {}
    for (const r of rows) {
      if (!r.vinno || !r.create_date) continue
      if (r.cancelled === 'Yes') continue
      if (!vinNewestDate[r.vinno] || r.create_date > vinNewestDate[r.vinno]) {
        vinNewestDate[r.vinno] = r.create_date
      }
    }

    const candidateVins = new Set<string>()
    const vinLatest: Record<string, any> = {}
    for (const r of rows) {
      if (!r.vinno || !r.create_date) continue
      if (r.cancelled === 'Yes') continue
      if (!r.create_date.startsWith(lastYearMonthPrefix)) continue
      candidateVins.add(r.vinno)
      if (!vinLatest[r.vinno] || r.create_date > vinLatest[r.vinno].create_date) {
        vinLatest[r.vinno] = r
      }
    }

    const pendingVins = [...candidateVins].filter(v => {
      const periodDate = vinLatest[v]?.create_date
      return periodDate && vinNewestDate[v] === periodDate
    })
    let allLogs: any[] = []
    try { allLogs = await fetchAll('call_logs') } catch (_) {}
    const logMap: Record<string, any> = {}
    const logCount: Record<string, number> = {}
    const logsByPolicy: Record<string, any[]> = {}
    for (const log of allLogs) {
      const key = log.policyno
      if (!logMap[key] || log.call_date > logMap[key].call_date) logMap[key] = log
      logCount[key] = (logCount[key] || 0) + 1
      if (!logsByPolicy[key]) logsByPolicy[key] = []
      logsByPolicy[key].push(log)
    }
    for (const key of Object.keys(logsByPolicy)) {
      logsByPolicy[key].sort((a: any, b: any) => new Date(b.call_date).getTime() - new Date(a.call_date).getTime())
    }
    const due: any[] = []
    for (const vin of pendingVins) {
      const r = vinLatest[vin]
      if (!r) continue
      const pno = r.policyno || ''
      const lastLog = logMap[pno]
      const history = (logsByPolicy[pno] || []).map((l: any) => ({
        outcome: l.call_outcome, date: l.call_date,
        agent: l.agent_name, remarks: l.remarks, follow_up: l.follow_up_date,
      }))
      due.push({
        policyno: pno, vinno: r.vinno || '',
        customer_name: r.customer_name || '-',
        model: r.model || '-',
        insurancecompany: r.insurancecompany || '-',
        grosspremium: Number(r.grosspremium) || 0,
        policy_expiry_date: parsePortalDate(r.policy_expiry_date),
        policy_effective_date: r.policy_effective_date || '',
        state: r.state || '', location: r.location || '', dealer: r.dealer || '',
        mobile: lastLog ? (lastLog.mobile_no || extractMobileFromRemarks(lastLog.remarks || '')) : '',
        create_date: r.create_date || '',
        call_status: lastLog ? lastLog.call_outcome : 'Pending',
        last_call_date: lastLog ? lastLog.call_date : null,
        last_remarks: lastLog ? sanitizeRemarks(lastLog.remarks || '') : '',
        last_agent: lastLog ? lastLog.agent_name : '',
        follow_up_date: lastLog ? lastLog.follow_up_date : null,
        log_id: lastLog ? lastLog.id : null,
        attempt_count: logCount[pno] || 0,
        history,
      })
    }
    return NextResponse.json({ due, total: due.length, month })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { fetchAll } from '@/lib/kia-insurance/supabase'
import { checkCookie, validateToken } from '@/lib/kia-insurance/auth'

export const dynamic = 'force-dynamic'

function authenticateFromRequest(req: Request, body?: any): boolean {
  if (checkCookie(req).valid) return true
  if (body?.token && validateToken(body.token).valid) return true
  const url = new URL(req.url)
  const tokenParam = url.searchParams.get('token')
  if (tokenParam && validateToken(tokenParam).valid) return true
  return false
}

function normalizeDate(v: any): string {
  if (!v) return ''
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/)
  if (m) {
    const d = parseInt(m[1], 10)
    const mo = parseInt(m[2], 10)
    const y = parseInt(m[3], 10)
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }
  const months: Record<string, number> = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 }
  const ma = s.match(/^(\d{1,2})\s*[- ]?\s*([A-Za-z]{3})(?:\s*[- ]?\s*(\d{2,4}))?$/)
  if (ma) {
    const mo2 = months[ma[2].toLowerCase()]
    if (mo2) {
      const d2 = parseInt(ma[1], 10)
      let y2: number
      if (ma[3]) {
        y2 = ma[3].length === 2 ? 2000 + parseInt(ma[3], 10) : parseInt(ma[3], 10)
      } else {
        y2 = new Date().getFullYear()
        if (mo2 < new Date().getMonth() + 1) y2 += 1
      }
      return `${y2}-${String(mo2).padStart(2, '0')}-${String(d2).padStart(2, '0')}`
    }
  }
  const dt = new Date(s)
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10)
  return ''
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!authenticateFromRequest(req, body)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const raw: any[] = Array.isArray(body.rows) ? body.rows : []
    if (!raw.length) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const existingPol = new Set<string>()
    const existingVin = new Set<string>()
    try {
      const all = await fetchAll('kia_insurance_form_data')
      for (const r of all) {
        if (r.policyno) existingPol.add(String(r.policyno).trim())
        if (r.vinno) existingVin.add(String(r.vinno).trim())
      }
    } catch (_) {}

    const rows: Record<string, any>[] = []
    const errors: any[] = []
    const skipped: any[] = []

    for (let i = 0; i < raw.length; i++) {
      const r = raw[i] || {}
      const rowNum = i + 1
      const policyno = String(r.policyno || '').trim()
      const vinno = String(r.vinno || '').trim()
      const customer_name = String(r.customer_name || '').trim()
      if (!customer_name) {
        errors.push({ row: rowNum, error: 'Customer Name is required' })
        continue
      }
      if (policyno && existingPol.has(policyno)) {
        skipped.push({ row: rowNum, policyno, reason: 'Policy already exists' })
        continue
      }
      if (!policyno && vinno && existingVin.has(vinno)) {
        skipped.push({ row: rowNum, vinno, reason: 'VIN already exists' })
        continue
      }
      if (policyno) existingPol.add(policyno)
      if (vinno) existingVin.add(vinno)
      rows.push({
        policyno,
        vinno,
        reg_no: String(r.reg_no || '').trim(),
        customer_name,
        model: String(r.model || '').trim(),
        insurancecompany: String(r.insurancecompany || '').trim(),
        policy_expiry_date: normalizeDate(r.policy_expiry_date),
        mobile_no: String(r.mobile_no || '').trim(),
        remarks: String(r.remarks || '').trim(),
        source: 'manual',
        lead_source: String(r.lead_source || '').trim() || null,
        source_agent: String(r.source_agent || '').trim(),
        follow_up_date: normalizeDate(r.follow_up_date) || null,
      })
    }

    let inserted = 0
    const followUps: any[] = []
    const insertedRows: any[] = []

    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100)
      const { data, error } = await supabase
        .from('kia_insurance_form_data')
        .insert(batch)
        .select('policyno,vinno,reg_no,customer_name,model,insurancecompany,policy_expiry_date,mobile_no,source_agent,follow_up_date')
      if (error) {
        errors.push({ row: i + 1, error: error.message })
        continue
      }
      const insertedBatch = data || []
      inserted += insertedBatch.length
      insertedRows.push(...insertedBatch)
      for (const row of insertedBatch) {
        if (row.follow_up_date && row.policyno) {
          followUps.push({
            policyno: row.policyno,
            vinno: row.vinno || '',
            customer_name: row.customer_name || '',
            model: row.model || '',
            insurancecompany: row.insurancecompany || '',
            policy_expiry_date: row.policy_expiry_date || '',
            call_outcome: 'Follow-up',
            follow_up_date: row.follow_up_date,
            agent_name: row.source_agent || '',
            mobile_no: row.mobile_no || '',
            call_date: new Date().toISOString(),
            remarks: 'Initial follow-up set via bulk upload',
          })
        }
      }
    }

    if (followUps.length) {
      try {
        for (let i = 0; i < followUps.length; i += 100) {
          await supabase.from('call_logs').insert(followUps.slice(i, i + 100))
        }
      } catch (_) {}
    }

    return NextResponse.json({
      inserted,
      skipped: skipped.length,
      failed: errors.length,
      total: raw.length,
      skippedDetails: skipped.slice(0, 50),
      errors: errors.slice(0, 50),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

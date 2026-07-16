import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
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

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!authenticateFromRequest(req, body)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { policyno, vinno, customer_name, model, insurancecompany, grosspremium, policy_expiry_date, call_outcome, remarks, follow_up_date, agent_name, mobile_no } = body
    if (!policyno || !call_outcome) {
      return NextResponse.json({ error: 'policyno and call_outcome are required' }, { status: 400 })
    }
    const payload: Record<string, any> = {
      policyno, vinno, customer_name, model, insurancecompany,
      grosspremium: grosspremium ? Number(grosspremium) : null,
      policy_expiry_date, call_outcome, remarks, follow_up_date: follow_up_date || null,
      agent_name: agent_name || '',
      call_date: new Date().toISOString(),
    }
    if (mobile_no) payload.mobile_no = mobile_no
    let { data, error } = await getSupabaseAdmin().from('call_logs').insert(payload).select().single()
    if (error) {
      if (error.message?.includes('relation') || error.code === '42P01') {
        return NextResponse.json({
          error: 'call_logs table does not exist.',
          sql: 'CREATE TABLE IF NOT EXISTS call_logs (id BIGSERIAL PRIMARY KEY, policyno TEXT, vinno TEXT, customer_name TEXT, model TEXT, insurancecompany TEXT, grosspremium NUMERIC, policy_expiry_date TEXT, mobile_no TEXT, call_date TIMESTAMPTZ DEFAULT NOW(), call_outcome TEXT NOT NULL, remarks TEXT, follow_up_date DATE, agent_name TEXT, created_at TIMESTAMPTZ DEFAULT NOW());',
        }, { status: 400 })
      }
      if (error.message?.includes('mobile_no')) {
        return NextResponse.json({
          error: 'mobile_no column missing.',
          sql: 'ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS mobile_no TEXT;',
        }, { status: 400 })
      }
      throw error
    }
    return NextResponse.json({ success: true, log: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

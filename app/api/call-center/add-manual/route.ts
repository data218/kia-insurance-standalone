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

    const {
      policyno, vinno, reg_no, customer_name, model, insurancecompany,
      policy_expiry_date, mobile_no, source_agent, follow_up_date,
      lead_source, remarks
    } = body

    if (!customer_name) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 })
    }

    const today = new Date().toISOString().slice(0, 10)
    const supabase = getSupabaseAdmin()

    const payload: Record<string, any> = {
      policyno: policyno || '',
      vinno: vinno || '',
      reg_no: reg_no || '',
      customer_name: customer_name || '',
      model: model || '',
      insurancecompany: insurancecompany || '',
      policy_expiry_date: policy_expiry_date || '',
      mobile_no: mobile_no || '',
      remarks: remarks || '',
      source: 'manual',
      lead_source: lead_source || null,
      source_agent: source_agent || '',
      follow_up_date: follow_up_date || null,
    }

    const { data, error } = await supabase
      .from('kia_insurance_form_data')
      .insert(payload)
      .select()
      .single()

    if (error) {
      if (error.message?.includes('relation') || error.code === '42P01') {
        return NextResponse.json({
          error: 'kia_insurance_form_data table does not exist.',
          sql: 'CREATE TABLE IF NOT EXISTS kia_insurance_form_data (id BIGSERIAL PRIMARY KEY, policyno TEXT DEFAULT \'\', vinno TEXT DEFAULT \'\', reg_no TEXT DEFAULT \'\', customer_name TEXT DEFAULT \'\', model TEXT DEFAULT \'\', insurancecompany TEXT DEFAULT \'\', policy_expiry_date TEXT DEFAULT \'\', mobile_no TEXT DEFAULT \'\', remarks TEXT DEFAULT \'\', source TEXT DEFAULT \'manual\', lead_source TEXT DEFAULT NULL, source_agent TEXT DEFAULT \'\', follow_up_date DATE DEFAULT NULL, created_at TIMESTAMPTZ DEFAULT NOW());',
        }, { status: 400 })
      }
      throw error
    }

    if (follow_up_date && policyno) {
      try {
        await supabase.from('call_logs').insert({
          policyno, vinno: vinno || '', customer_name: customer_name || '',
          model: model || '', insurancecompany: insurancecompany || '',
          policy_expiry_date: policy_expiry_date || '',
          call_outcome: 'Follow-up', follow_up_date,
          agent_name: source_agent || '', mobile_no: mobile_no || '',
          call_date: new Date().toISOString(),
          remarks: 'Initial follow-up set during manual entry',
        })
      } catch (_) {}
    }

    return NextResponse.json({ success: true, entry: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { checkCookie, validateToken } from '@/lib/kia-insurance/auth'

export const dynamic = 'force-dynamic'

function authenticate(req: Request): boolean {
  if (checkCookie(req).valid) return true
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (token && validateToken(token).valid) return true
  return false
}

function normalize(v: any): string {
  return String(v ?? '').trim().toUpperCase()
}

export async function GET(req: Request) {
  try {
    if (!authenticate(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const q = normalize(searchParams.get('q'))
    if (!q) {
      return NextResponse.json({ found: false })
    }

    const supabase = getSupabaseAdmin()

    const { data: leads, error: lErr } = await supabase
      .from('kia_insurance_form_data')
      .select('policyno, vinno, reg_no, customer_name, model, insurancecompany, policy_expiry_date, mobile_no, remarks')
      .or(`reg_no.eq.${q},vinno.eq.${q},policyno.eq.${q}`)
      .order('created_at', { ascending: false })
      .limit(1)

    if (!lErr && leads && leads.length) {
      return NextResponse.json({ found: true, source: 'lead', data: leads[0] })
    }

    const { data: ins, error: iErr } = await supabase
      .from('kia_insurance')
      .select('policyno, vinno, veh_regist_no, customer_name, model, insurancecompany, policy_expiry_date')
      .or(`vinno.eq.${q},veh_regist_no.eq.${q},policyno.eq.${q}`)
      .order('create_date', { ascending: false })
      .limit(1)

    if (!iErr && ins && ins.length) {
      const r = ins[0]
      return NextResponse.json({
        found: true,
        source: 'policy',
        data: {
          policyno: r.policyno || '',
          vinno: r.vinno || '',
          reg_no: r.veh_regist_no || '',
          customer_name: r.customer_name || '',
          model: r.model || '',
          insurancecompany: r.insurancecompany || '',
          policy_expiry_date: r.policy_expiry_date || '',
          mobile_no: '',
          remarks: '',
        },
      })
    }

    return NextResponse.json({ found: false })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

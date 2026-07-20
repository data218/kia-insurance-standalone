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
      policyno, vinno, customer_name, model, insurancecompany,
      grosspremium, policy_expiry_date, policy_effective_date,
      mobile_no, state, create_date, source_agent
    } = body

    if (!policyno || !customer_name) {
      return NextResponse.json({ error: 'Policy number and customer name are required' }, { status: 400 })
    }

    const today = new Date().toISOString().slice(0, 10)

    const payload: Record<string, any> = {
      policyno: policyno || '',
      vinno: vinno || '',
      customer_name: customer_name || '',
      model: model || '',
      insurancecompany: insurancecompany || '',
      grosspremium: grosspremium ? Number(grosspremium) : 0,
      policy_expiry_date: policy_expiry_date || '',
      policy_effective_date: policy_effective_date || '',
      state: state || '',
      location: '',
      dealer: '',
      create_date: create_date || today,
      cancelled: null,
      is_new: null,
      policytype: null,
      mfg_year: null,
      paymentmode: null,
      totalidv: null,
      netodpremiuma: null,
      source: 'manual',
      uploaded_at: new Date().toISOString(),
    }

    const { data, error } = await getSupabaseAdmin()
      .from('kia_insurance')
      .insert(payload)
      .select()
      .single()

    if (error) {
      if (error.message?.includes('source') || error.code === '42703') {
        return NextResponse.json({
          error: 'source column missing. Run this SQL first:',
          sql: "ALTER TABLE kia_insurance ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'kia_safety';",
        }, { status: 400 })
      }
      throw error
    }

    return NextResponse.json({ success: true, entry: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

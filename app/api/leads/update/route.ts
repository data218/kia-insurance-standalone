import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { checkCookie, validateToken } from '@/lib/kia-insurance/auth'

export const dynamic = 'force-dynamic'

function authenticate(req: Request, body?: any): boolean {
  if (checkCookie(req).valid) return true
  if (body?.token && validateToken(body.token).valid) return true
  const url = new URL(req.url)
  const tokenParam = url.searchParams.get('token')
  if (tokenParam && validateToken(tokenParam).valid) return true
  return false
}

const EDITABLE_FIELDS = [
  'customer_name', 'mobile_no', 'policyno', 'vinno', 'reg_no', 'model',
  'insurancecompany', 'policy_expiry_date', 'lead_source', 'source_agent',
  'follow_up_date', 'remarks',
]

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!authenticate(req, body)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = body.id
    if (id == null) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const payload: Record<string, any> = {}
    for (const f of EDITABLE_FIELDS) {
      if (body[f] !== undefined) payload[f] = body[f]
    }
    if (!payload.customer_name) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('kia_insurance_form_data')
      .update(payload)
      .eq('id', Number(id))
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, entry: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

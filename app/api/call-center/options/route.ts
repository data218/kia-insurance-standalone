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

export async function GET(req: Request) {
  try {
    if (!authenticate(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()

    const [modelsRes, insurersRes] = await Promise.all([
      supabase.from('kia_insurance').select('model').not('model', 'is', null),
      supabase.from('kia_insurance').select('insurancecompany').not('insurancecompany', 'is', null),
    ])

    const models = [...new Set((modelsRes.data || []).map((r: any) => r.model).filter(Boolean))].sort()
    const insurers = [...new Set((insurersRes.data || []).map((r: any) => r.insurancecompany).filter(Boolean))].sort()

    return NextResponse.json({ models, insurers })
  } catch (err: any) {
    return NextResponse.json({ models: [], insurers: [] })
  }
}

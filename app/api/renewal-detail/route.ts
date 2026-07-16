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

export async function GET(req: Request) {
  try {
    if (!authenticate(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rows = await fetchAll('kia_insurance')
    const vinMap: Record<string, { customer: string; model: string; lastPremium: number; lastDate: string; status: string }> = {}
    for (const r of rows) {
      const vin = r.vinno
      if (!vin) continue
      const d = r.create_date
      if (!d) continue
      const existing = vinMap[vin]
      if (!existing || d > existing.lastDate) {
        vinMap[vin] = {
          customer: r.customer_name || '',
          model: r.model || '',
          lastPremium: Number(r.grosspremium) || 0,
          lastDate: d,
          status: r.is_new === 'Yes' ? 'New' : 'Active',
        }
      }
    }
    const detail = Object.entries(vinMap).map(([vin, data]) => ({ vin, ...data }))
    return NextResponse.json({ detail })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

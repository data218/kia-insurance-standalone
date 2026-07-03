import { NextResponse } from 'next/server'
import { fetchAll } from '@/lib/kia-insurance/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
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

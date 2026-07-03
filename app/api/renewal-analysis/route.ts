import { NextResponse } from 'next/server'
import { fetchAll } from '@/lib/kia-insurance/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const rows = await fetchAll('kia_insurance')
    const months: Record<string, { new: number; renewal: number }> = {}
    for (const r of rows) {
      if (r.cancelled === 'Yes') continue
      const d = r.create_date
      if (!d) continue
      let year: string, month: string
      if (d.includes('/')) {
        const p = d.split('/')
        year = p[2]; month = p[1].padStart(2, '0')
      } else {
        const p = d.split('-')
        year = p[0]; month = p[1].padStart(2, '0')
      }
      if (!year || !month) continue
      const key = year + '-' + month
      if (!months[key]) months[key] = { new: 0, renewal: 0 }
      if (r.is_new === 'Yes') months[key].new++
      else months[key].renewal++
    }
    if (Object.keys(months).length === 0) {
      return NextResponse.json({ months: [], newData: [], renewalData: [], conversionData: [] })
    }
    const sortedKeys = Object.keys(months).sort()
    const newData = sortedKeys.map(k => months[k].new)
    const renewalData = sortedKeys.map(k => months[k].renewal)
    const conversionData = sortedKeys.map(k => months[k].renewal)
    return NextResponse.json({ months: sortedKeys, newData, renewalData, conversionData })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

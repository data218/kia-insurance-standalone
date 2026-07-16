import { NextResponse } from 'next/server'
import { fetchAll } from '@/lib/kia-insurance/supabase'
import { checkCookie } from '@/lib/kia-insurance/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const auth = checkCookie(req)
    if (!auth.valid) {
      const url = new URL(req.url)
      const token = url.searchParams.get('token')
      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const { validateToken } = await import('@/lib/kia-insurance/auth')
      const result = validateToken(token)
      if (!result.valid) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const rows = await fetchAll('kia_insurance')
    return NextResponse.json({ rows, total: rows.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

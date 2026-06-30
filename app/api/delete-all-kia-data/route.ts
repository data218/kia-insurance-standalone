import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json()
    if (username !== 'admin' || password !== 'admin123') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { error } = await supabaseAdmin.from('kia_insurance').delete().neq('id', 0)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { validateToken } from '@/lib/kia-insurance/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { token } = await req.json()
    const result = validateToken(token)
    if (!result.valid || !result.user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    const supabase = getSupabaseAdmin()
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('role')
      .eq('username', result.user.username)
      .eq('is_active', true)
      .single()

    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const { data: users } = await supabase
      .from('admin_users')
      .select('id, username, role, full_name, email, is_active, created_at, last_login')
      .order('id')

    return NextResponse.json({ users: users || [] })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { validateToken } from '@/lib/kia-insurance/auth'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { token, username, password, role } = await req.json()
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

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('admin_users')
      .select('id')
      .eq('username', username)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 })
    }

    const hash = await bcrypt.hash(password, 10)
    const { error } = await supabase.from('admin_users').insert({
      username,
      password_hash: hash,
      role: role || 'user',
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

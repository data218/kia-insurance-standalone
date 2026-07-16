import { NextResponse } from 'next/server'
import { makeToken } from '@/lib/kia-insurance/auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json()
    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Username and password required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data: user, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .single()

    if (error || !user) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 })
    }

    const validPassword = await bcrypt.compare(password, user.password_hash)
    if (!validPassword) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 })
    }

    await supabase.from('admin_users').update({ last_login: new Date().toISOString() }).eq('id', user.id)

    const token = makeToken(user.username, user.role)
    const res = NextResponse.json({
      success: true,
      token,
      user: { username: user.username, role: user.role, full_name: user.full_name, email: user.email, last_login: user.last_login }
    })
    res.cookies.set('kia_admin_token', token, {
      path: '/',
      httpOnly: true,
      maxAge: 86400,
      sameSite: 'lax',
    })
    return res
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })
  }
}

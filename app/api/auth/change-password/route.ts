import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/kia-insurance/auth'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const auth = requireAuth(req)
    if (!auth.valid) return auth.response!

    const { currentPassword, newPassword } = await req.json()
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ success: false, error: 'All fields required' }, { status: 400 })
    }
    if (newPassword.length < 4) {
      return NextResponse.json({ success: false, error: 'Password min 4 characters' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data: user, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('username', auth.user!.username)
      .eq('is_active', true)
      .single()

    if (error || !user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const valid = await bcrypt.compare(currentPassword, user.password_hash)
    if (!valid) {
      return NextResponse.json({ success: false, error: 'Current password incorrect' }, { status: 401 })
    }

    const hash = await bcrypt.hash(newPassword, 10)
    await supabase.from('admin_users').update({ password_hash: hash, updated_at: new Date().toISOString() }).eq('id', user.id)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })
  }
}

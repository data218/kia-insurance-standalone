import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { validateToken } from '@/lib/kia-insurance/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { token, userId, newUsername } = await req.json()
    const result = validateToken(token)
    if (!result.valid || !result.user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    if (!userId || !newUsername) {
      return NextResponse.json({ error: 'userId and newUsername required' }, { status: 400 })
    }

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

    const { data: existing } = await supabase
      .from('admin_users')
      .select('id')
      .eq('username', newUsername)
      .neq('id', userId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 400 })
    }

    const { error } = await supabase
      .from('admin_users')
      .update({ username: newUsername, updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (error) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { token, userId, newUsername } = await req.json()
    const session = decodeToken(token)
    if (!session) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    if (!userId || !newUsername) {
      return NextResponse.json({ error: 'userId and newUsername required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('role')
      .eq('username', session.username)
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

function decodeToken(token: string): { username: string; role: string } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 2) return null
    const decoded = JSON.parse(Buffer.from(parts[0], 'base64').toString())
    return { username: decoded.u, role: decoded.r }
  } catch {
    return null
  }
}

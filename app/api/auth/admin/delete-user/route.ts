import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { token, userId } = await req.json()
    const session = decodeToken(token)
    if (!session) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id, role')
      .eq('username', session.username)
      .eq('is_active', true)
      .single()

    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    if (Number(userId) === adminUser.id) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
    }

    const { error } = await supabase
      .from('admin_users')
      .delete()
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

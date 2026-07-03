import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { token } = await req.json()
    const session = decodeToken(token)
    if (!session) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

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

    const { data: activities } = await supabase
      .from('auth_activities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    return NextResponse.json({ activities: activities || [] })
  } catch {
    return NextResponse.json({ activities: [] })
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

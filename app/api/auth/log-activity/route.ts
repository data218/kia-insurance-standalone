import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { checkCookie } from '@/lib/kia-insurance/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { action, page, details } = await req.json()
    const auth = checkCookie(req)
    const username = auth.user?.username || 'User'

    try {
      await getSupabaseAdmin().from('auth_activities').insert({
        user_id: auth.user?.username || 'main-dashboard',
        username,
        action: action || 'view',
        page: page || '',
        details: details || {},
        created_at: new Date().toISOString(),
      })
    } catch (_) {}
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false })
  }
}

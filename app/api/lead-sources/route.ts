import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { checkCookie, validateToken } from '@/lib/kia-insurance/auth'

export const dynamic = 'force-dynamic'

function authenticate(req: Request): boolean {
  if (checkCookie(req).valid) return true
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (token && validateToken(token).valid) return true
  return false
}

export async function GET(req: Request) {
  try {
    if (!authenticate(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('cc_lead_sources')
      .select('name')
      .order('name', { ascending: true })
    if (error) {
      return NextResponse.json({ sources: [] })
    }
    return NextResponse.json({ sources: (data || []).map((r: any) => r.name) })
  } catch (err: any) {
    return NextResponse.json({ sources: [], error: err.message })
  }
}

export async function POST(req: Request) {
  try {
    if (!authenticate(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await req.json()
    const name = (body.name || '').trim().toUpperCase()
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('cc_lead_sources')
      .insert({ name })
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Source already exists' }, { status: 409 })
      }
      throw error
    }
    const { data } = await supabase
      .from('cc_lead_sources')
      .select('name')
      .order('name', { ascending: true })
    return NextResponse.json({ sources: (data || []).map((r: any) => r.name) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    if (!authenticate(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = new URL(req.url)
    const name = url.searchParams.get('name')
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('cc_lead_sources')
      .delete()
      .eq('name', name)
    if (error) throw error
    const { data } = await supabase
      .from('cc_lead_sources')
      .select('name')
      .order('name', { ascending: true })
    return NextResponse.json({ sources: (data || []).map((r: any) => r.name) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

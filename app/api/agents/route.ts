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

async function ensureTable(supabase: any): Promise<boolean> {
  const { error } = await supabase.from('cc_agents').select('id').limit(1)
  if (!error) return true
  if (error.code !== '42P01') return false

  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) return false

  try {
    const { Client } = await import('pg')
    const client = new Client({ connectionString: dbUrl })
    await client.connect()
    await client.query(`
      CREATE TABLE IF NOT EXISTS cc_agents (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cc_agents_name ON cc_agents(name)`)
    await client.end()
    return true
  } catch {
    return false
  }
}

export async function GET(req: Request) {
  try {
    if (!authenticate(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const supabase = getSupabaseAdmin()
    const tableReady = await ensureTable(supabase)
    if (!tableReady) {
      return NextResponse.json({ agents: [], error: 'cc_agents table not found. Run migration SQL in Supabase dashboard.' })
    }
    const { data, error } = await supabase
      .from('cc_agents')
      .select('name')
      .order('name', { ascending: true })
    if (error) throw error
    return NextResponse.json({ agents: (data || []).map((r: any) => r.name) })
  } catch (err: any) {
    return NextResponse.json({ agents: [], error: err.message })
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
    const tableReady = await ensureTable(supabase)
    if (!tableReady) {
      return NextResponse.json({ error: 'cc_agents table not found. Run migration SQL in Supabase dashboard.' }, { status: 500 })
    }
    const { error } = await supabase
      .from('cc_agents')
      .insert({ name })
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Agent already exists' }, { status: 409 })
      }
      throw error
    }
    const { data } = await supabase
      .from('cc_agents')
      .select('name')
      .order('name', { ascending: true })
    return NextResponse.json({ agents: (data || []).map((r: any) => r.name) })
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
    const tableReady = await ensureTable(supabase)
    if (!tableReady) {
      return NextResponse.json({ error: 'cc_agents table not found. Run migration SQL in Supabase dashboard.' }, { status: 500 })
    }
    const { error } = await supabase
      .from('cc_agents')
      .delete()
      .eq('name', name)
    if (error) throw error
    const { data } = await supabase
      .from('cc_agents')
      .select('name')
      .order('name', { ascending: true })
    return NextResponse.json({ agents: (data || []).map((r: any) => r.name) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

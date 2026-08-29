import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { checkCookie, validateToken } from '@/lib/kia-insurance/auth'
import { Client } from 'pg'

export const dynamic = 'force-dynamic'

function authenticate(req: Request): boolean {
  if (checkCookie(req).valid) return true
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (token && validateToken(token).valid) return true
  return false
}

export async function POST(req: Request) {
  try {
    if (!authenticate(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()
    const { error: checkError } = await supabase.from('cc_agents').select('id').limit(1)
    if (!checkError) {
      return NextResponse.json({ message: 'Table already exists', created: false })
    }

    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) {
      return NextResponse.json({ error: 'DATABASE_URL not set' }, { status: 500 })
    }

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

    return NextResponse.json({ message: 'Table created successfully', created: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

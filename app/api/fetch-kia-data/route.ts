import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { from, to } = await req.json()
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing Supabase env vars')
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    
    // Get count before
    const { count: countBefore, error: countError } = await supabase
      .from('kia_insurance')
      .select('*', { count: 'exact', head: true })
    
    if (countError) throw countError
    
    return NextResponse.json({
      success: true,
      message: 'Kia Safety cron runs daily at 10 AM. Data is auto-fetched from kiasafety.com',
      insertedRowCount: 0,
      duplicateRowCount: countBefore || 0,
      note: 'Use the Refresh button to refresh materialized views after cron runs'
    })
  } catch (err: any) {
    // Check if it's a network/DNS error (Kia Safety website unreachable)
    if (err.message?.includes('ENOTFOUND') || err.message?.includes('ECONNREFUSED') || err.message?.includes('network') || err.message?.includes('fetch')) {
      return NextResponse.json({ success: false, urlError: true, error: 'Kia Safety website not reachable' }, { status: 502 })
    }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing Supabase env vars')
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    
    const { data: latestRow } = await supabase
      .from('kia_insurance')
      .select('create_date, uploaded_at')
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .single()
    
    const { count: totalCount } = await supabase
      .from('kia_insurance')
      .select('*', { count: 'exact', head: true })
    
    return NextResponse.json({
      latestUpload: latestRow?.uploaded_at,
      latestRecordDate: latestRow?.create_date,
      totalRecords: totalCount || 0
    })
  } catch (err: any) {
    if (err.message?.includes('ENOTFOUND') || err.message?.includes('ECONNREFUSED') || err.message?.includes('network') || err.message?.includes('fetch')) {
      return NextResponse.json({ urlError: true, error: 'Kia Safety website not reachable' }, { status: 502 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

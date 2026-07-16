import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabase = getSupabaseAdmin()

    const { count: totalCount, error: countError } = await supabase
      .from('kia_insurance')
      .select('*', { count: 'exact', head: true })

    if (countError) throw countError

    const { data: latestRow } = await supabase
      .from('kia_insurance')
      .select('create_date, uploaded_at')
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({
      success: true,
      message: 'Data is live from kia_insurance table. Cron job fetches data daily from kiasafety.com.',
      totalRecords: totalCount || 0,
      latestUpload: latestRow?.uploaded_at || null,
      latestRecordDate: latestRow?.create_date || null,
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()

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
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

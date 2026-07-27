import { NextResponse } from 'next/server'
import { validateToken } from '@/lib/kia-insurance/auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { token, mode, from, to } = await req.json()

    const result = validateToken(token || '')
    if (!result.valid) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    let fromDate: Date
    let toDate: Date

    if (mode === 'd1') {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      fromDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate())
      toDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate())
    } else if (mode === 'custom' && from && to) {
      fromDate = new Date(from)
      toDate = new Date(to)
      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        return NextResponse.json({ success: false, error: 'Invalid date format' }, { status: 400 })
      }
      if (fromDate > toDate) {
        return NextResponse.json({ success: false, error: 'From date must be before To date' }, { status: 400 })
      }
    } else {
      const now = new Date()
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1)
      toDate = now
    }

    const { fetchKiaData } = await import('@/lib/kia-insurance/scraper')
    const fetchResult = await fetchKiaData(fromDate, toDate)

    return NextResponse.json({
      success: fetchResult.success,
      message: fetchResult.success
        ? `Fetched ${fetchResult.total} records (${fetchResult.inserted} saved, ${fetchResult.duplicates} duplicates)`
        : fetchResult.error,
      insertedRowCount: fetchResult.inserted,
      duplicateRowCount: fetchResult.duplicates,
      totalRows: fetchResult.total,
      failedMonths: fetchResult.failedMonths,
      error: fetchResult.error,
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

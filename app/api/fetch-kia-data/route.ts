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
    } else if (mode === 'today') {
      const today = new Date()
      fromDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      toDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
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
      return NextResponse.json({ success: false, error: 'Invalid mode. Use: d1, today, or custom' }, { status: 400 })
    }

    const { fetchKiaData, SCRAPER_VERSION } = await import('@/lib/kia-insurance/scraper')
    const fetchResult = await fetchKiaData(fromDate, toDate)

    let msg = ''
    if (fetchResult.success) {
      if (fetchResult.alreadyExisted && fetchResult.alreadyExisted > 0) {
        msg = `${fetchResult.alreadyExisted} records already in database. Inserted ${fetchResult.inserted} new, updated ${fetchResult.updated} existing with latest data`
      } else {
        msg = `Fetched ${fetchResult.total} records, inserted ${fetchResult.inserted} new`
      }
      if (fetchResult.failedMonths?.length) {
        msg += `. Failed months: ${fetchResult.failedMonths.join(', ')}`
      }
    }

    return NextResponse.json({
      success: fetchResult.success,
      version: SCRAPER_VERSION || 'unknown',
      message: msg || fetchResult.error,
      insertedRowCount: fetchResult.inserted,
      updatedRowCount: fetchResult.updated,
      duplicateRowCount: fetchResult.duplicates,
      alreadyExisted: fetchResult.alreadyExisted,
      totalRows: fetchResult.total,
      failedMonths: fetchResult.failedMonths,
      error: fetchResult.error,
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    if (!token || !validateToken(token).valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
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

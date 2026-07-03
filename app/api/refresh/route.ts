import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  // Data is fetched directly from kia_insurance table.
  // No materialized views to refresh.
  return NextResponse.json({ success: true, message: 'Data is live from kia_insurance table' })
}

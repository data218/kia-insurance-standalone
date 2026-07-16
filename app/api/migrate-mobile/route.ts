import { NextResponse } from 'next/server'
// @ts-expect-error pg has no type declarations
import pg from 'pg'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (body.secret !== 'kia-migrate-2026') {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 403 })
    }

    const connStr = process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING
    if (!connStr) {
      return NextResponse.json({ error: 'DATABASE_URL not set' }, { status: 500 })
    }

    const c = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } })
    await c.connect()

    // Step 1: Add mobile_no column
    await c.query('ALTER TABLE kia_insurance ADD COLUMN IF NOT EXISTS mobile_no TEXT')

    // Step 2: Map VINs from ro_billing_report
    const result = await c.query(`
      UPDATE kia_insurance ki
      SET mobile_no = sub.mobile_no
      FROM (
        SELECT DISTINCT ON (vin) vin, mobile_no
        FROM ro_billing_report
        WHERE mobile_no IS NOT NULL AND mobile_no != ''
        ORDER BY vin, bill_date DESC
      ) sub
      WHERE ki.vinno = sub.vin AND (ki.mobile_no IS NULL OR ki.mobile_no = '')
    `)

    // Step 3: Check results
    const filled = await c.query(`SELECT count(*) FROM kia_insurance WHERE mobile_no IS NOT NULL AND mobile_no != ''`)
    const total = await c.query('SELECT count(*) FROM kia_insurance')
    const matched = await c.query(`
      SELECT count(DISTINCT ki.vinno) FROM kia_insurance ki 
      INNER JOIN (SELECT DISTINCT vin FROM ro_billing_report WHERE mobile_no IS NOT NULL AND mobile_no != '') sub 
      ON ki.vinno = sub.vin
    `)

    const sample = await c.query(`SELECT vinno, customer_name, mobile_no FROM kia_insurance WHERE mobile_no IS NOT NULL AND mobile_no != '' LIMIT 5`)

    await c.end()

    return NextResponse.json({
      success: true,
      updated: result.rowCount,
      totalInsurance: total.rows[0].count,
      matchedVins: matched.rows[0].count,
      withMobile: filled.rows[0].count,
      sample: sample.rows
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

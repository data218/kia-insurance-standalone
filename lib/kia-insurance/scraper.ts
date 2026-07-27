import crypto from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const LOGIN_URL = 'https://www.kiasafety.com/VISOF/Login.aspx'
const LIST_URL = 'https://www.kiasafety.com/VISOF/Report/VSPolicy_SummaryReportList.aspx'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const KIA_HEADERS = [
  'Sno','BRAND','State','Location','DealerCode','Dealer',
  'policy_effective_date','Policy_expiry_date','InsuranceCompany',
  'PolicyNo','PolicyType','Class','ProductType','Model',
  'FuelType','Variant','VinNo','EngineNo','Create_Date',
  'PaymentGenerated','PaymentNo','PaymentMode','ODDiscount',
  'Cancelled','Cancelled_Date','Endorsed','ChequeNo','TotalIDV',
  'NetODPremiumA','NetPremium','IGST','CGST','SGST','UGST',
  'GrossPremium','CUSTOMER_NAME','Package_Name','NCB_SLAB_PER',
  'VEH_REGIST_NO','MFG_YEAR','ACH_CC_Status','Prev_POLICY_NO',
  'Prev_IC_NAME','Quotation_No','IS_LONGTERM','IS_CRP'
]

const NON_BUSINESS_HASH_COLUMNS = new Set([
  'id','row_hash','full_row_hash','business_identity_key',
  'uploaded_at','s_no','sno','sr_no','serial_no','sl_no',
  'no','source_login_id'
])

const DATE_COLUMNS = new Set([
  'policy_effective_date','policy_expiry_date','create_date','cancelled_date'
])

const NUMERIC_COLUMNS = new Set(['igst','cgst','sgst'])

const FORCED_TEXT_PATTERNS = [
  (n: string) => n === 'sac_hsn' || n === 'hsn',
  (n: string) => n.endsWith('_hsn'),
  (n: string) => n.endsWith('_code'),
  (n: string) => n.endsWith('_no'),
  (n: string) => n.includes('invoice'),
  (n: string) => n.includes('irn'),
  (n: string) => n.includes('acknowledge'),
]

const NUMERIC_TOKENS = [
  'amt','amount','total','tax','count','qty','quantity',
  'mileage','rate','value','price','cgst','sgst','igst','cess','discount'
]

function normalizeSqlName(value: string, fallback = 'column'): string {
  const normalized = String(value ?? '').trim().toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  const safe = normalized || fallback
  return /^[a-z_]/.test(safe) ? safe : `${fallback}_${safe}`
}

function isForcedText(name: string): boolean {
  return FORCED_TEXT_PATTERNS.some(fn => fn(name))
}

function headerLooksDate(normalized: string): boolean {
  if (normalized.endsWith('_type')) return false
  return /(^|_)date($|_)/.test(normalized) ||
    normalized.endsWith('_dt') ||
    normalized.includes('uploaded_at')
}

function headerLooksNumeric(normalized: string): boolean {
  if (isForcedText(normalized)) return false
  return NUMERIC_TOKENS.some(t => normalized === t || normalized.includes(`_${t}`) || normalized.includes(`${t}_`))
}

function inferType(header: string): 'date' | 'numeric' | 'text' {
  const n = normalizeSqlName(header)
  if (isForcedText(n)) return 'text'
  if (headerLooksDate(n)) return 'date'
  if (headerLooksNumeric(n)) return 'numeric'
  return 'text'
}

function formatDatePortal(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}/${MONTH_NAMES[date.getMonth()]}/${date.getFullYear()}`
}

function parseDateValue(value: string): string | null {
  const text = String(value ?? '').trim()
  if (!text) return null
  const monDate = text.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/)
  if (monDate) {
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
    const mi = months.indexOf(monDate[2].toLowerCase())
    if (mi >= 0) {
      return `${monDate[3]}-${String(mi + 1).padStart(2, '0')}-${String(parseInt(monDate[1])).padStart(2, '0')}`
    }
  }
  const slashDate = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (slashDate) {
    return `${slashDate[3]}-${slashDate[2].padStart(2, '0')}-${slashDate[1].padStart(2, '0')}`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.substring(0, 10)
  return null
}

function parseNumericValue(value: string): number | null {
  const text = String(value ?? '').trim().replace(/,/g, '')
  if (!text) return null
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return null
  return Number(text)
}

function normalizeValue(value: string | null | undefined, colType: 'date' | 'numeric' | 'text'): string | number | null {
  if (value == null || String(value).trim() === '') return null
  if (colType === 'date') return parseDateValue(value)
  if (colType === 'numeric') return parseNumericValue(value)
  return String(value).trim() || null
}

interface ColDef { header: string; name: string; type: 'date' | 'numeric' | 'text' }

function buildColumns(): ColDef[] {
  const used = new Map<string, number>()
  return KIA_HEADERS.map(header => {
    let name = normalizeSqlName(header, 'column')
    if (NON_BUSINESS_HASH_COLUMNS.has(name)) name = `source_${name}`
    const count = used.get(name) ?? 0
    used.set(name, count + 1)
    if (count > 0) name = `${name}_${count + 1}`
    return { header, name, type: inferType(header) }
  })
}

function generateRowHash(rawRow: Record<string, any>, columns: ColDef[]): string {
  const entries = columns
    .map(col => [col.name, normalizeValue(rawRow[col.header], col.type)] as [string, string | number | null])
    .filter(([key]) => key && !NON_BUSINESS_HASH_COLUMNS.has(key))
    .sort(([a], [b]) => a.localeCompare(b))
  return crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex')
}

function extractCookies(headers: Headers): Record<string, string> {
  const cookies: Record<string, string> = {}
  const setCookies = (headers as any).getSetCookie?.() || []
  for (const c of setCookies) {
    const [kv] = c.split(';')
    const eqIdx = kv.indexOf('=')
    if (eqIdx > 0) cookies[kv.substring(0, eqIdx).trim()] = kv.substring(eqIdx + 1).trim()
  }
  return cookies
}

function mergeCookies(existing: Record<string, string>, headers: Headers): Record<string, string> {
  const merged = { ...existing }
  const setCookies = (headers as any).getSetCookie?.() || []
  for (const c of setCookies) {
    const [kv] = c.split(';')
    const eqIdx = kv.indexOf('=')
    if (eqIdx > 0) merged[kv.substring(0, eqIdx).trim()] = kv.substring(eqIdx + 1).trim()
  }
  return merged
}

function cookieString(cookies: Record<string, string>): string {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
}

function extractViewState(html: string): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const p of [
    /id="__VIEWSTATE"[^>]*value="([^"]*)"/i,
    /id="__VIEWSTATEGENERATOR"[^>]*value="([^"]*)"/i,
    /id="__EVENTVALIDATION"[^>]*value="([^"]*)"/i,
  ]) {
    const m = html.match(p)
    if (m) {
      const name = m[0].match(/id="([^"]+)"/i)?.[1]
      if (name) fields[name] = m[1]
    }
  }
  return fields
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function loginToPortal(username: string, password: string): Promise<Record<string, string>> {
  const loginPageResp = await fetch(LOGIN_URL, { redirect: 'follow', headers: { 'User-Agent': UA } })
  const loginHtml = await loginPageResp.text()
  let cookies = extractCookies(loginPageResp.headers)

  const vs = extractViewState(loginHtml)
  const body = new URLSearchParams({ ...vs, txtUserName: username, txtPassword: password, btnLogin: 'Sign In' })

  const loginResp = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookieString(cookies), 'User-Agent': UA },
    body: body.toString(),
    redirect: 'follow'
  })
  cookies = mergeCookies(cookies, loginResp.headers)

  const finalUrl = loginResp.url || ''
  if (finalUrl.includes('Login.aspx')) {
    const text = await loginResp.text()
    if (/invalid|error|fail/i.test(text)) {
      throw new Error('Login failed - check credentials in Settings')
    }
  }

  return cookies
}

function monthChunks(fromDate: Date, toDate: Date): Array<{ start: Date; end: Date; label: string }> {
  const chunks: Array<{ start: Date; end: Date; label: string }> = []
  if (fromDate.getTime() === toDate.getTime()) {
    chunks.push({
      start: fromDate, end: toDate,
      label: `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-${String(fromDate.getDate()).padStart(2, '0')}`
    })
    return chunks
  }
  let cur = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1)
  while (cur <= toDate) {
    const ms = new Date(cur.getFullYear(), cur.getMonth(), 1)
    const me = new Date(cur.getFullYear(), cur.getMonth() + 1, 0)
    chunks.push({
      start: ms < fromDate ? fromDate : ms,
      end: me > toDate ? toDate : me,
      label: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`
    })
    cur.setMonth(cur.getMonth() + 1)
  }
  return chunks
}

function parseHtmlTable(html: string): { headers: string[]; rows: string[][] } {
  const tables = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi) || []
  for (const table of tables) {
    let headers: string[] = []
    const theadMatch = table.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i)
    if (theadMatch) {
      headers = [...theadMatch[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)]
        .map(m => m[1].replace(/<[^>]+>/g, '').trim())
    }
    if (headers.length < 3) {
      const firstTr = table.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i)
      if (firstTr) {
        const ths = [...firstTr[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)]
        if (ths.length >= 3) headers = ths.map(m => m[1].replace(/<[^>]+>/g, '').trim())
      }
    }
    if (headers.length < 3) continue

    const tbodyMatch = table.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i)
    if (!tbodyMatch) continue

    const rows: string[][] = []
    const trs = [...tbodyMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    for (const tr of trs) {
      const cells = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
        .map(m => m[1].replace(/<[^>]+>/g, '').trim())
      if (cells.length >= 3) rows.push(cells)
    }
    if (rows.length > 0) return { headers, rows }
  }
  return { headers: [], rows: [] }
}

async function fetchMonthChunk(cookies: Record<string, string>, fromDate: Date, toDate: Date): Promise<{ headers: string[]; rows: string[][] }> {
  const url = `${LIST_URL}?dtefrm=${encodeURIComponent(formatDatePortal(fromDate))}&dteto=${encodeURIComponent(formatDatePortal(toDate))}&zoneid=0&stateid=0&cityid=0&productid=0&OEMType=1&DealerGroupCode=0`
  const resp = await fetch(url, { headers: { 'Cookie': cookieString(cookies), 'User-Agent': UA }, redirect: 'follow' })
  const html = await resp.text()
  if (/no\s+records?\s+found|no\s+data/i.test(html)) return { headers: [], rows: [] }
  return parseHtmlTable(html)
}

export interface FetchResult {
  success: boolean
  inserted: number
  duplicates: number
  total: number
  failedMonths: string[]
  error?: string
}

export async function fetchKiaData(fromDate: Date, toDate: Date): Promise<FetchResult> {
  const supabase = getSupabaseAdmin()

  const { data: cred, error: credError } = await supabase
    .from('kia_credentials')
    .select('username, password')
    .eq('id', 1)
    .single()

  if (credError || !cred) {
    return { success: false, inserted: 0, duplicates: 0, total: 0, failedMonths: [], error: 'Kia portal credentials not configured. Go to Settings and Save Credentials first.' }
  }

  let cookies: Record<string, string>
  try {
    cookies = await loginToPortal(cred.username, cred.password)
  } catch (e: any) {
    return { success: false, inserted: 0, duplicates: 0, total: 0, failedMonths: [], error: `Login failed: ${e.message}` }
  }

  const chunks = monthChunks(fromDate, toDate)
  const columns = buildColumns()
  const allRows: Array<Record<string, any>> = []
  const failedMonths: string[] = []

  for (const chunk of chunks) {
    try {
      const { headers, rows } = await fetchMonthChunk(cookies, chunk.start, chunk.end)
      if (rows.length === 0) continue

      for (const cells of rows) {
        const record: Record<string, any> = {}
        for (let j = 0; j < KIA_HEADERS.length && j < cells.length; j++) {
          record[KIA_HEADERS[j]] = cells[j]
        }
        allRows.push(record)
      }
    } catch {
      failedMonths.push(chunk.label)
    }
  }

  if (allRows.length === 0) {
    return { success: true, inserted: 0, duplicates: 0, total: 0, failedMonths }
  }

  const fromStr = fromDate.toISOString().split('T')[0]
  const toStr = toDate.toISOString().split('T')[0]
  await supabase.from('kia_insurance').delete().gte('create_date', fromStr).lte('create_date', toStr)

  let inserted = 0
  const batchSize = 500
  const uploadedAt = new Date().toISOString()

  for (let i = 0; i < allRows.length; i += batchSize) {
    const batch = allRows.slice(i, i + batchSize)
    const insertData = batch.map(rawRow => {
      const row: Record<string, any> = {}
      for (const col of columns) {
        row[col.name] = normalizeValue(rawRow[col.header], col.type)
      }
      row.row_hash = generateRowHash(rawRow, columns)
      row.uploaded_at = uploadedAt
      return row
    })

    const { data, error } = await supabase
      .from('kia_insurance')
      .upsert(insertData, { onConflict: 'row_hash', ignoreDuplicates: false })
      .select('row_hash')

    if (error) throw error
    inserted += data?.length || 0
  }

  return { success: true, inserted, duplicates: allRows.length - inserted, total: allRows.length, failedMonths }
}

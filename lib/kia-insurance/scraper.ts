import crypto from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

// v2.3 - KIA Fetch now uses the portal CSV export (46 columns incl. NetODPremiumA/ChequeNo/TotalIDV/BRAND)
// via an authenticated ASP.NET postback; falls back to HTML grid parsing if export is unavailable.
export const SCRAPER_VERSION = '2.3.0'

const LOGIN_URL = 'https://www.kiasafety.com/VISOF/Login.aspx'
const LIST_URL = 'https://www.kiasafety.com/VISOF/Report/VSPolicy_SummaryReportList.aspx'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const DB_COLUMNS = [
  'sno','state','location','dealercode','dealer',
  'policy_effective_date','policy_expiry_date','insurancecompany',
  'policyno','policytype','class','producttype','model',
  'fueltype','variant','vinno','engineno','create_date',
  'paymentgenerated','paymentno','paymentmode','oddiscount',
  'cancelled','cancelled_date','endorsed',
  'netpremium','igst','cgst','sgst','ugst',
  'grosspremium','netodpremiuma','customer_name',
  'mfg_year','ach_cc_status','quotation_no','is_longterm','is_crp'
]

const PORTAL_HEADER_TO_DB: Record<string, string> = {
  'sno': 'sno',
  'state': 'state',
  'location': 'location',
  'dealer code': 'dealercode',
  'dealer': 'dealer',
  'customer name': 'customer_name',
  'insurance company': 'insurancecompany',
  'policy no': 'policyno',
  'policy type': 'policytype',
  'class': 'class',
  'product type': 'producttype',
  'model': 'model',
  'fuel type': 'fueltype',
  'variant': 'variant',
  'vin no': 'vinno',
  'engine no': 'engineno',
  'created date': 'create_date',
  'createddate': 'create_date',
  'payment generated': 'paymentgenerated',
  'payment no': 'paymentno',
  'payment mode': 'paymentmode',
  'cancelled': 'cancelled',
  'cancelled date': 'cancelled_date',
  'cancelleddate': 'cancelled_date',
  'endorsed': 'endorsed',
  'risk start date': 'policy_effective_date',
  'risk end date': 'policy_expiry_date',
  'net premium': 'netpremium',
  'igst': 'igst',
  'sgst': 'sgst',
  'cgst': 'cgst',
  'gross premium': 'grosspremium',
  'netodpremiuma': 'netodpremiuma',
  'net od premium a': 'netodpremiuma',
  'manufacturer year': 'mfg_year',
  'ach corporate card status': 'ach_cc_status',
  'quotation no': 'quotation_no',
  'is long term': 'is_longterm',
  'is crp': 'is_crp',
}

const PHANTOM_HEADERS = new Set([
  'zone',
  'vehicle type',
  'policy issuance mode',
  'od discount',
  'ugst',
])

const CSV_HEADER_TO_DB: Record<string, string> = {
  'sno': 'sno',
  'brand': 'brand',
  'state': 'state',
  'location': 'location',
  'dealercode': 'dealercode',
  'dealer': 'dealer',
  'policy_effective_date': 'policy_effective_date',
  'policy_expiry_date': 'policy_expiry_date',
  'insurancecompany': 'insurancecompany',
  'policyno': 'policyno',
  'policytype': 'policytype',
  'class': 'class',
  'producttype': 'producttype',
  'model': 'model',
  'fueltype': 'fueltype',
  'variant': 'variant',
  'vinno': 'vinno',
  'engineno': 'engineno',
  'create_date': 'create_date',
  'paymentgenerated': 'paymentgenerated',
  'paymentno': 'paymentno',
  'paymentmode': 'paymentmode',
  'oddiscount': 'oddiscount',
  'cancelled': 'cancelled',
  'cancelled_date': 'cancelled_date',
  'endorsed': 'endorsed',
  'chequeno': 'chequeno',
  'totalidv': 'totalidv',
  'netodpremiuma': 'netodpremiuma',
  'netpremium': 'netpremium',
  'igst': 'igst',
  'cgst': 'cgst',
  'sgst': 'sgst',
  'ugst': 'ugst',
  'grosspremium': 'grosspremium',
  'customer_name': 'customer_name',
  'package_name': 'package_name',
  'ncb_slab_per': 'ncb_slab_per',
  'veh_regist_no': 'veh_regist_no',
  'mfg_year': 'mfg_year',
  'ach_cc_status': 'ach_cc_status',
  'prev_policy_no': 'prev_policy_no',
  'prev_ic_name': 'prev_ic_name',
  'quotation_no': 'quotation_no',
  'is_longterm': 'is_longterm',
  'is_crp': 'is_crp',
}

function normalizeCsvHeader(header: string): string {
  return String(header ?? '').trim().toLowerCase()
}

function parseCsvToRows(csvText: string): { headers: string[]; rows: Array<Record<string, string>> } {
  const text = csvText.replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/)
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()
  if (!lines.length) return { headers: [], rows: [] }

  const parseLine = (line: string): string[] => {
    const cells: string[] = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++ } else inQuotes = false
        } else cur += ch
      } else {
        if (ch === '"') inQuotes = true
        else if (ch === ',') { cells.push(cur); cur = '' }
        else cur += ch
      }
    }
    cells.push(cur)
    return cells
  }

  const headers = parseLine(lines[0])
  const rows: Array<Record<string, string>> = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const cells = parseLine(lines[i])
    const row: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) row[headers[j]] = cells[j] ?? ''
    rows.push(row)
  }
  return { headers, rows }
}

const NON_BUSINESS_HASH_COLUMNS = new Set([
  'id','row_hash','full_row_hash','business_identity_key',
  'uploaded_at','s_no','sno','sr_no','serial_no','sl_no',
  'no','source_login_id'
])

const DATE_DB_COLUMNS = new Set(['create_date', 'cancelled_date', 'policy_effective_date', 'policy_expiry_date'])
const NUMERIC_DB_COLUMNS = new Set(['igst','cgst','sgst','ugst','netpremium','grosspremium','oddiscount','totalidv','netodpremiuma'])

const AES_ENC_KEY = '8080808080808080'
const AES_ENC_IV  = '8080808080808080'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function formatDateLocal(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function aesEncrypt(plaintext: string): string {
  const key = Buffer.from(AES_ENC_KEY, 'utf-8')
  const iv  = Buffer.from(AES_ENC_IV, 'utf-8')
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv)
  let enc = cipher.update(plaintext, 'utf-8', 'base64')
  enc += cipher.final('base64')
  return enc
}

function extractCookies(headers: Headers): Record<string, string> {
  const cookies: Record<string, string> = {}
  const setCookies = (headers as any).getSetCookie?.() || []
  for (const c of setCookies) {
    const eqIdx = c.indexOf('=')
    if (eqIdx <= 0) continue
    const name = c.substring(0, eqIdx).trim()
    const rest = c.substring(eqIdx + 1)
    const semiIdx = rest.indexOf(';')
    const value = (semiIdx >= 0 ? rest.substring(0, semiIdx) : rest).trim()
    if (name && name.toLowerCase() !== 'path' && name.toLowerCase() !== 'expires') cookies[name] = value
  }
  return cookies
}

function mergeCookies(existing: Record<string, string>, headers: Headers): Record<string, string> {
  const merged = { ...existing }
  const setCookies = (headers as any).getSetCookie?.() || []
  for (const c of setCookies) {
    const eqIdx = c.indexOf('=')
    if (eqIdx <= 0) continue
    const name = c.substring(0, eqIdx).trim()
    const rest = c.substring(eqIdx + 1)
    const semiIdx = rest.indexOf(';')
    const value = (semiIdx >= 0 ? rest.substring(0, semiIdx) : rest).trim()
    if (name && name.toLowerCase() !== 'path' && name.toLowerCase() !== 'expires') merged[name] = value
  }
  return merged
}

function cookieString(cookies: Record<string, string>): string {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
}

function extractAllFormFields(html: string): Record<string, string> {
  const fields: Record<string, string> = {}
  const inputRegex = /<input[^>]+>/gi
  let match
  while ((match = inputRegex.exec(html)) !== null) {
    const tag = match[0]
    const nameMatch = tag.match(/name="([^"]+)"/i)
    const valueMatch = tag.match(/value="([^"]*)"/i)
    if (!nameMatch) continue
    fields[nameMatch[1]] = (valueMatch && valueMatch[1]) || ''
  }
  return fields
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
    if (mi >= 0) return `${monDate[3]}-${String(mi + 1).padStart(2, '0')}-${String(parseInt(monDate[1])).padStart(2, '0')}`
  }
  const dashMonDate = text.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/)
  if (dashMonDate) {
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
    const mi = months.indexOf(dashMonDate[2].toLowerCase())
    if (mi >= 0) return `${dashMonDate[3]}-${String(mi + 1).padStart(2, '0')}-${String(parseInt(dashMonDate[1])).padStart(2, '0')}`
  }
  const slashDate = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (slashDate) return `${slashDate[3]}-${slashDate[2].padStart(2, '0')}-${slashDate[1].padStart(2, '0')}`
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.substring(0, 10)
  return null
}

function parseNumericValue(value: string): number | null {
  const text = String(value ?? '').trim().replace(/,/g, '')
  if (!text || !/^-?\d+(?:\.\d+)?$/.test(text)) return null
  return Number(text)
}

function normalizeValue(value: string | null | undefined, colName: string): string | number | null {
  if (value == null || String(value).trim() === '') return null
  const trimmed = String(value).trim()
  if (DATE_DB_COLUMNS.has(colName)) return parseDateValue(trimmed)
  if (NUMERIC_DB_COLUMNS.has(colName)) return parseNumericValue(trimmed)
  if (colName === 'policyno') return trimmed.replace(/^`+/, '') || null
  return trimmed || null
}

function stripHtmlComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, '')
}

const IDENTITY_COLUMNS = ['policyno', 'vinno', 'create_date']

function generateRowHash(rowData: Record<string, any>): string {
  const identity = IDENTITY_COLUMNS
    .map(col => [col, String(rowData[col] ?? '').trim()] as [string, string])
    .filter(([, value]) => value !== '')
  if (identity.length === IDENTITY_COLUMNS.length) {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify([['__table', 'kia_insurance'], ...identity]))
      .digest('hex')
  }
  const entries = Object.entries(rowData)
    .filter(([key]) => key && !NON_BUSINESS_HASH_COLUMNS.has(key))
    .sort(([a], [b]) => a.localeCompare(b))
  return crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex')
}

async function followRedirects(startUrl: string, cookies: Record<string, string>, maxRedirects = 5): Promise<Record<string, string>> {
  let url = startUrl
  for (let i = 0; i < maxRedirects; i++) {
    const resp = await fetch(url, {
      redirect: 'manual',
      headers: { 'Cookie': cookieString(cookies), 'User-Agent': UA, Referer: LOGIN_URL },
    })
    cookies = mergeCookies(cookies, resp.headers)
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get('location')
      if (!loc) break
      url = loc.startsWith('http') ? loc : new URL(loc, LOGIN_URL).href
      continue
    }
    break
  }
  return cookies
}

async function loginToPortal(username: string, password: string): Promise<Record<string, string>> {
  const loginPageResp = await fetch(LOGIN_URL, { redirect: 'follow', headers: { 'User-Agent': UA } })
  const loginHtml = await loginPageResp.text()
  let cookies = extractCookies(loginPageResp.headers)

  const fields = extractAllFormFields(loginHtml)
  const encUser = aesEncrypt(username)
  const encPass = aesEncrypt(password)

  const formData = new URLSearchParams()
  for (const [key, val] of Object.entries(fields)) formData.set(key, val)
  formData.set('txtUserName', '')
  formData.set('txtPassword', encPass)
  formData.set('HDusername', encUser)
  formData.set('HDpassword', encPass)
  formData.set('btnLogin', 'Sign In')

  const loginResp = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieString(cookies),
      'User-Agent': UA,
      'Origin': 'https://www.kiasafety.com',
      'Referer': LOGIN_URL,
    },
    body: formData.toString(),
    redirect: 'manual'
  })
  cookies = mergeCookies(cookies, loginResp.headers)

  if (loginResp.status === 302) {
    const loc = loginResp.headers.get('location')
    if (loc) {
      const absUrl = loc.startsWith('http') ? loc : new URL(loc, LOGIN_URL).href
      cookies = await followRedirects(absUrl, cookies)
    }
  }

  const welcomeResp = await fetch(new URL('/VISOF/Welcome/Welcome.aspx', LOGIN_URL).href, {
    redirect: 'manual',
    headers: { 'Cookie': cookieString(cookies), 'User-Agent': UA },
  })
  cookies = mergeCookies(cookies, welcomeResp.headers)

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

function parseHtmlTable(html: string): { dbColumns: string[]; rows: Record<string, any>[] } {
  const tables = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi) || []
  let bestTable = ''
  let bestThCount = 0

  for (const table of tables) {
    const ths = (table.match(/<th/gi) || []).length
    const tds = (table.match(/<td/gi) || []).length
    if (ths >= 3 && tds >= ths && ths > bestThCount) {
      bestThCount = ths
      bestTable = table
    }
  }

  if (!bestTable) return { dbColumns: [], rows: [] }

  const trs = [...bestTable.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map(m => m[1])

  if (trs.length < 2) return { dbColumns: [], rows: [] }

  const headerCells = [...trs[0].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)]
    .map(m => m[1].replace(/<[^>]+>/g, '').trim())

  const headerNorms = headerCells.map(h =>
    h.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
  )

  const dbColumns: string[] = []
  const seenDbCols = new Set<string>()
  for (const norm of headerNorms) {
    const dbCol = PORTAL_HEADER_TO_DB[norm]
    if (dbCol && !seenDbCols.has(dbCol)) {
      seenDbCols.add(dbCol)
      dbColumns.push(dbCol)
    }
  }

  if (dbColumns.length < 3) return { dbColumns: [], rows: [] }

  const rows: Record<string, any>[] = []
  for (let r = 1; r < trs.length; r++) {
    const cells = [...trs[r].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map(m => m[1].replace(/<[^>]+>/g, '').trim())
    if (cells.length < 20) continue

    let cellIdx = 0
    const row: Record<string, any> = {}
    const usedDbCols = new Set<string>()

    for (let j = 0; j < headerCells.length; j++) {
      const norm = headerNorms[j]

      if (PHANTOM_HEADERS.has(norm)) {
        continue
      }

      const dbCol = PORTAL_HEADER_TO_DB[norm]
      if (dbCol) {
        if (!usedDbCols.has(dbCol) && cellIdx < cells.length) {
          row[dbCol] = cells[cellIdx]
          usedDbCols.add(dbCol)
        }
        cellIdx++
      } else if (cellIdx < cells.length) {
        cellIdx++
      }
    }
    rows.push(row)
  }

  return { dbColumns, rows }
}

function buildGridUrl(fromDate: Date, toDate: Date): string {
  return `${LIST_URL}?dtefrm=${encodeURIComponent(formatDatePortal(fromDate))}&dteto=${encodeURIComponent(formatDatePortal(toDate))}&zoneid=0&stateid=0&cityid=0&productid=0&OEMType=1&DealerGroupCode=0`
}

async function tryExportCsv(cookies: Record<string, string>, gridUrl: string, gridHtml: string): Promise<string | null> {
  try {
    const fields = extractAllFormFields(gridHtml)
    if (!fields['__VIEWSTATE']) return null
    const body = new URLSearchParams()
    for (const [key, val] of Object.entries(fields)) {
      if (key === 'btnExport' || key === 'btnPrint' || key === 'btnClose') continue
      body.set(key, val)
    }
    body.set('btnExport', 'Export to CSV')

    const resp = await fetch(gridUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieString(cookies),
        'User-Agent': UA,
        'Origin': 'https://www.kiasafety.com',
        'Referer': gridUrl,
      },
      body: body.toString(),
      redirect: 'manual'
    })
    const ct = resp.headers.get('content-type') || ''
    const disp = resp.headers.get('content-disposition') || ''
    if (!(ct.includes('csv') || disp.includes('.csv') || disp.includes('attachment'))) return null
    return await resp.text()
  } catch {
    return null
  }
}

async function fetchMonthChunk(cookies: Record<string, string>, fromDate: Date, toDate: Date) {
  const url = buildGridUrl(fromDate, toDate)
  const resp = await fetch(url, { headers: { 'Cookie': cookieString(cookies), 'User-Agent': UA }, redirect: 'manual' })
  if ([301, 302, 303, 307, 308].includes(resp.status)) {
    throw new Error('Session expired during fetch (redirect to login detected)')
  }
  const html = await resp.text()
  if (/no\s+records?\s+found|no\s+data/i.test(html)) return { dbColumns: [] as string[], rows: [] as Record<string, any>[] }
  if (/<form[\s\S]*?Login/i.test(html)) throw new Error('Session expired during fetch (login page returned)')

  const csv = await tryExportCsv(cookies, url, html)
  if (csv) {
    const { headers, rows } = parseCsvToRows(csv)
    const dbColumns: string[] = []
    const seenDbCols = new Set<string>()
    for (const h of headers) {
      const dbCol = CSV_HEADER_TO_DB[normalizeCsvHeader(h)]
      if (dbCol && !seenDbCols.has(dbCol)) {
        seenDbCols.add(dbCol)
        dbColumns.push(dbCol)
      }
    }
    if (dbColumns.length >= 3 && rows.length) {
      const mapped: Record<string, any>[] = rows.map(csvRow => {
        const row: Record<string, any> = {}
        for (const h of headers) {
          const dbCol = CSV_HEADER_TO_DB[normalizeCsvHeader(h)]
          if (dbCol) row[dbCol] = csvRow[h] ?? ''
        }
        return row
      })
      return { dbColumns, rows: mapped }
    }
  }

  return parseHtmlTable(html)
}

export interface FetchResult {
  success: boolean
  inserted: number
  updated: number
  duplicates: number
  total: number
  alreadyExisted: number
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
    return { success: false, inserted: 0, updated: 0, duplicates: 0, total: 0, alreadyExisted: 0, failedMonths: [], error: 'Kia portal credentials not configured. Go to Settings and Save Credentials first.' }
  }

  let cookies: Record<string, string>
  try {
    cookies = await loginToPortal(cred.username, cred.password)
  } catch (e: any) {
    return { success: false, inserted: 0, updated: 0, duplicates: 0, total: 0, alreadyExisted: 0, failedMonths: [], error: `Login failed: ${e.message}` }
  }

  const chunks = monthChunks(fromDate, toDate)
  const allRows: Record<string, any>[] = []
  const failedMonths: string[] = []
  let dbColumns: string[] = []

  for (const chunk of chunks) {
    try {
      const result = await fetchMonthChunk(cookies, chunk.start, chunk.end)
      if (result.rows.length > 0) {
        if (!dbColumns.length) dbColumns = result.dbColumns
        allRows.push(...result.rows)
      }
    } catch (e: any) {
      console.error(`Failed to fetch chunk ${chunk.label}:`, e?.message || e)
      failedMonths.push(chunk.label)
    }
  }

  if (allRows.length === 0) {
    if (failedMonths.length > 0) {
      return { success: false, inserted: 0, updated: 0, duplicates: 0, total: 0, alreadyExisted: 0, failedMonths, error: `Failed months: ${failedMonths.join(', ')}` }
    }
    return { success: true, inserted: 0, updated: 0, duplicates: 0, total: 0, alreadyExisted: 0, failedMonths }
  }

  const fromStr = formatDateLocal(fromDate)
  const toStr = formatDateLocal(toDate)

  // Fetch existing row hashes in the date range so we can report insert vs update accurately
  const existingHashes = new Set<string>()
  let existingCount = 0
  let pageFrom = 0
  const pageSize = 1000
  while (true) {
    const { data, error, count } = await supabase
      .from('kia_insurance')
      .select('row_hash', { count: pageFrom === 0 ? 'exact' : undefined })
      .gte('create_date', fromStr)
      .lte('create_date', toStr)
      .range(pageFrom, pageFrom + pageSize - 1)
    if (error) break
    if (pageFrom === 0 && count) existingCount = count
    if (!data?.length) break
    data.forEach((r: any) => { if (r.row_hash) existingHashes.add(r.row_hash) })
    if (data.length < pageSize) break
    pageFrom += pageSize
  }

  const insertedRows: Record<string, any>[] = []
  const updateRows: Record<string, any>[] = []
  const uploadedAt = new Date().toISOString()

  for (const rawRow of allRows) {
    const row: Record<string, any> = {}
    for (const col of dbColumns) {
      row[col] = normalizeValue(rawRow[col], col)
    }
    row.row_hash = generateRowHash(row)
    row.uploaded_at = uploadedAt
    if (existingHashes.has(row.row_hash)) {
      updateRows.push(row)
    } else {
      insertedRows.push(row)
    }
  }

  let inserted = 0
  let updated = 0
  const batchSize = 500

  // Insert new rows
  for (let i = 0; i < insertedRows.length; i += batchSize) {
    const batch = insertedRows.slice(i, i + batchSize)
    const { data, error } = await supabase
      .from('kia_insurance')
      .upsert(batch, { onConflict: 'row_hash', ignoreDuplicates: false })
      .select('row_hash')
    if (error) throw error
    inserted += data?.length || 0
  }

  // Upsert existing rows in place with full data (fixes sparse rows from older grid-only fetches)
  for (let i = 0; i < updateRows.length; i += batchSize) {
    const batch = updateRows.slice(i, i + batchSize)
    const { data, error } = await supabase
      .from('kia_insurance')
      .upsert(batch, { onConflict: 'row_hash', ignoreDuplicates: false })
      .select('row_hash')
    if (error) throw error
    updated += data?.length || 0
  }

  return { success: true, inserted, updated, duplicates: 0, total: allRows.length, alreadyExisted: existingCount, failedMonths }
}

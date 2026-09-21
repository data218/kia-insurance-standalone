import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { validateToken } from '@/lib/kia-insurance/auth'

const noCacheHeaders = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
}

export function transformHtml(content: string): string {
  content = content.replace(/location\.href\s*=\s*['"]#?['"]/g, `location.href='/performance'`)
  content = content.replace(/location\.href\s*=\s*['"](?!\/\/|\/api|http)[^'"]*['"]/g, (m) => {
    if (m.includes('/performance') || m.includes('performance')) return m
    if (m.includes("''")) return `location.href='/performance'`
    return m
  })
  content = injectNav(content)
  return content
}

function injectNav(content: string): string {
  const navStyle = 'display:flex;align-items:center;gap:4px;padding:4px 12px;background:var(--panel,#f0f4ff);border-bottom:1px solid var(--border,#d0dce8);flex-shrink:0;flex-wrap:wrap'
  const tabStyle = 'padding:4px 12px;border:1px solid var(--border,#d0dce8);border-radius:6px;font-size:11px;text-decoration:none;background:var(--card,#fff);color:var(--muted,#333);transition:.1s'
  const activeStyle = 'padding:4px 12px;border:1px solid var(--accent,#002db3);border-radius:6px;font-size:11px;text-decoration:none;background:var(--accent,#002db3);color:#fff;font-weight:600'
  const adminBtnStyle = 'margin-left:8px;padding:3px 10px;border-radius:6px;font-size:10px;text-decoration:none;background:var(--accent,#1e40af);color:#fff;font-weight:600;border:none;cursor:pointer;transition:.1s'
  const selectWrapStyle = 'margin-left:auto;display:flex;align-items:center;gap:6px'
  const selectLabelStyle = 'font-size:10px;color:var(--muted,#333);font-weight:600'
  const pageLinks = [
    { path: '/dashboard', label: 'Data Analysis', dataPage: 'dashboard' },
    { path: '/performance', label: 'Performance Table', dataPage: 'performance' },
    { path: '/call-center', label: 'Call Center', dataPage: 'call-center' },
    { path: '/leads', label: 'Leads', dataPage: 'leads' },
  ]
  let navHtml = '<div id="insNav" style="' + navStyle + '">'
  for (const link of pageLinks) {
    navHtml += '<a href="' + link.path + '" style="' + tabStyle + '" data-page="' + link.dataPage + '">' + link.label + '</a>'
  }
  navHtml += '<div id="insThemeWrap" style="' + selectWrapStyle + '"><span style="' + selectLabelStyle + '">Theme</span><select id="themeSelect" class="theme-select" title="Theme"></select></div>'
  navHtml += '<a href="/login" style="' + adminBtnStyle + '">Admin Login</a>'
  navHtml += '</div>'
  navHtml += '<script>(function(){var p=window.location.pathname.replace(/\\/+$/,"");var links=document.getElementById("insNav").querySelectorAll("a");for(var i=0;i<links.length;i++){if(p.endsWith(links[i].getAttribute("data-page"))){links[i].style.cssText="' + activeStyle + '"}}})()<' + '/script>'
  navHtml += '<script src="/theme.js"></script>'
  return content.replace('<body>', '<body>' + navHtml)
}

function getTokenFromRequest(req: Request): string | null {
  const cookie = req.headers.get('cookie') || ''
  const match = cookie.match(/kia_admin_token=([^;]+)/)
  if (match) return decodeURIComponent(match[1])
  const url = new URL(req.url)
  return url.searchParams.get('token')
}

export function serveHtml(relativePath: string): NextResponse {
  const filePath = path.join(process.cwd(), relativePath)
  const content = fs.readFileSync(filePath, 'utf8')
  const transformed = transformHtml(content)
  return new NextResponse(transformed, { headers: noCacheHeaders })
}

export function serveProtectedHtml(relativePath: string, req: Request): NextResponse {
  const token = getTokenFromRequest(req)
  if (!token || !validateToken(token).valid) {
    const url = new URL('/login', req.url)
    return NextResponse.redirect(url)
  }
  return serveHtml(relativePath)
}

export function serveLandingHtml(): NextResponse {
  const filePath = path.join(process.cwd(), 'kia-insurance-dashboard', 'landing.html')
  let content = fs.readFileSync(filePath, 'utf8')
  content = content.replace(/const API = ''/g, 'const API = ""')
  content = content.replace(/if\(!t\)\s*\{[^}]*location\.href\s*=\s*['"]#?['"][^}]*\}/g, '')
  return new NextResponse(content, { headers: noCacheHeaders })
}

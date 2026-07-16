import crypto from 'crypto'

const TOKEN_HMAC_SECRET = process.env.TOKEN_HMAC_SECRET || 'kia-token-hmac-2025-xK9mP2vL'
const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

export interface TokenPayload {
  u: string
  r: string
  t: number // issued at timestamp
}

export function makeToken(username: string, role: string): string {
  const payload: TokenPayload = { u: username, r: role, t: Date.now() }
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', TOKEN_HMAC_SECRET).update(b64).digest('base64url').substring(0, 16)
  return b64 + '.' + sig
}

export function validateToken(token: string): { valid: boolean; user?: { username: string; role: string }; expired?: boolean } {
  if (!token) return { valid: false }

  const parts = token.split('.')
  if (parts.length !== 2) return { valid: false }

  try {
    const expectedSig = crypto.createHmac('sha256', TOKEN_HMAC_SECRET).update(parts[0]).digest('base64url').substring(0, 16)
    if (!crypto.timingSafeEqual(Buffer.from(parts[1]), Buffer.from(expectedSig))) {
      return { valid: false }
    }

    const decoded: TokenPayload = JSON.parse(Buffer.from(parts[0], 'base64url').toString())

    if (!decoded.u || !decoded.r || !decoded.t) return { valid: false }

    const age = Date.now() - decoded.t
    if (age > TOKEN_MAX_AGE_MS) {
      return { valid: false, expired: true }
    }

    return { valid: true, user: { username: decoded.u, role: decoded.r } }
  } catch {
    return { valid: false }
  }
}

export function checkCookie(req: Request): { valid: boolean; user?: { username: string; role: string } } {
  const cookie = req.headers.get('cookie') || ''
  const match = cookie.match(/kia_admin_token=([^;]+)/)
  if (!match) return { valid: false }
  return validateToken(decodeURIComponent(match[1]))
}

export function requireAuth(req: Request): { valid: boolean; user?: { username: string; role: string }; response?: Response } {
  const auth = checkCookie(req)
  if (!auth.valid) {
    return {
      valid: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
  return { valid: true, user: auth.user }
}

export function requireAdmin(req: Request): { valid: boolean; user?: { username: string; role: string }; response?: Response } {
  const auth = checkCookie(req)
  if (!auth.valid) {
    return {
      valid: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
  if (auth.user?.role !== 'admin') {
    return {
      valid: false,
      response: new Response(JSON.stringify({ error: 'Admin only' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
  return { valid: true, user: auth.user }
}

export function decodeToken(token: string): TokenPayload | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  try {
    return JSON.parse(Buffer.from(parts[0], 'base64url').toString())
  } catch {
    return null
  }
}

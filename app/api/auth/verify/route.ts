import { NextResponse } from 'next/server'
import { validateToken } from '@/lib/kia-insurance/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { token } = await req.json()
    const result = validateToken(token || '')
    if (result.valid) {
      return NextResponse.json({ valid: true, user: result.user })
    }
    return NextResponse.json({ valid: false }, { status: 401 })
  } catch {
    return NextResponse.json({ valid: false }, { status: 400 })
  }
}

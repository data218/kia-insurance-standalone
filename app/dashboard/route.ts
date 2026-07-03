import { serveProtectedHtml } from '@/lib/kia-insurance/html'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return serveProtectedHtml('kia-insurance-dashboard/index.html', req)
}

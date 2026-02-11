import { NextRequest, NextResponse } from 'next/server'

/**
 * List of known search engine and bot user agents
 */
const BOT_PATTERNS = [
  'googlebot',
  'bingbot',
  'yandexbot',
  'slurp',
  'duckduckbot',
  'baiduspider',
  'sogou',
  'exabot',
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'whatsapp',
  'telegrambot',
  'applebot',
  'msnbot',
  'mediapartners-google',
  'curl',
  'wget',
  'python',
  'scrapy',
  'phantom',
  'headless',
  'petalbot',
  'semrushbot',
  'ahrefs',
  'mj12bot',
  'uptimerobot',
  'pingdom',
  'statuscake',
]

/**
 * Detects if the request is from a bot or crawler
 */
function isBot(userAgent: string | null): boolean {
  if (!userAgent) return false

  const lowerUserAgent = userAgent.toLowerCase()
  return BOT_PATTERNS.some(pattern => lowerUserAgent.includes(pattern))
}

export function middleware(request: NextRequest) {
  const userAgent = request.headers.get('user-agent')
  const userType = isBot(userAgent) ? 'bot' : 'user'
  const pathname = request.nextUrl.pathname

  // Authentication check for /admin routes (exclude /admin/login)
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    // Check if token exists in cookies
    const token = request.cookies.get('token')?.value

    // If no token, redirect to login
    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // Clone the request headers
  const requestHeaders = new Headers(request.headers)

  // Add custom header for downstream logic
  requestHeaders.set('x-user-type', userType)
  requestHeaders.set('x-user-agent', userAgent || 'unknown')

  // Create response with modified headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  // Add response headers for transparency
  response.headers.set('x-user-type', userType)

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}

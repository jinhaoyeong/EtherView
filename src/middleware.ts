import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone()
  if (url.pathname === '/index' || url.pathname === '/index.html') {
    url.pathname = '/'
    return NextResponse.redirect(url, 308)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/index', '/index.html']
}

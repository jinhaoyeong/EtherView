import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export function GET(req: NextRequest) {
  const url = new URL('/', req.url)
  return NextResponse.redirect(url, 308)
}

export function HEAD(req: NextRequest) {
  const url = new URL('/', req.url)
  return NextResponse.redirect(url, 308)
}

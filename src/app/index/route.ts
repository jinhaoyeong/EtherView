import { NextRequest, NextResponse } from 'next/server'

export function GET(req: NextRequest) {
  const url = new URL('/', req.url)
  return NextResponse.redirect(url, 308)
}

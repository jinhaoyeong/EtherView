import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Check if request has content before parsing JSON
    const contentLength = request.headers.get('content-length');
    if (!contentLength || parseInt(contentLength) === 0) {
      console.error('❌ Empty request body received');
      return NextResponse.json(
        { error: 'Empty request body' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, counter, payload } = body;

    // Log the metric (in production, you'd send this to a monitoring service)
    console.log(`📊 Metric: ${name}`, {
      counter,
      payload,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    });

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Metric recorded',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error recording metric:', error);
    return NextResponse.json(
      { error: 'Failed to record metric' },
      { status: 500 }
    );
  }
}
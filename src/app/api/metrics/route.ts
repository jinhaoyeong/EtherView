import { NextRequest, NextResponse } from 'next/server';

const MAX_BODY_BYTES = 4096;
const NUMERIC_FIELDS = ['value', 'duration'] as const;

export async function POST(request: NextRequest) {
  try {
    const declaredLength = Number(request.headers.get('content-length') || '0');
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Metric body is too large' }, { status: 413 });
    }

    const raw = await request.text();
    if (!raw.trim()) {
      return NextResponse.json({ error: 'Empty request body' }, { status: 400 });
    }
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Metric body is too large' }, { status: 413 });
    }

    const body = JSON.parse(raw) as unknown;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid metric' }, { status: 400 });
    }
    const record = body as Record<string, unknown>;
    if (typeof record.name !== 'string' || !/^[a-z0-9_]{1,64}$/i.test(record.name)) {
      return NextResponse.json({ error: 'Invalid metric name' }, { status: 400 });
    }

    const fields: Record<string, number> = {};
    for (const key of NUMERIC_FIELDS) {
      if (record[key] === undefined) continue;
      if (typeof record[key] !== 'number' || !Number.isFinite(record[key])) {
        return NextResponse.json({ error: 'Invalid metric value' }, { status: 400 });
      }
      fields[key] = record[key];
    }

    console.log('Metric recorded', { name: record.name, ...fields });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to record metric' }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from 'next/server';

/**
 * Same-origin proxy for attachment PDF preview.
 * Fetches from the backend and streams the response so the browser gets
 * the exact PDF bytes without proxy/encoding issues.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id || id === 'legacy') {
    return NextResponse.json({ message: 'Invalid attachment' }, { status: 400 });
  }

  const backendBase =
    process.env.BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3001';
  const url = `${backendBase.replace(/\/$/, '')}/files/attachments/${id}/download`;

  const auth = request.headers.get('authorization') || '';

  const res = await fetch(url, {
    method: 'GET',
    headers: auth ? { Authorization: auth } : {},
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return NextResponse.json(
        { message: json.message || res.statusText },
        { status: res.status }
      );
    } catch {
      return NextResponse.json(
        { message: text || res.statusText },
        { status: res.status }
      );
    }
  }

  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  const contentLength = res.headers.get('content-length');
  const body = res.body;

  const headers = new Headers({
    'Content-Type': contentType,
    'Cache-Control': 'private, max-age=3600',
  });
  if (contentLength) headers.set('Content-Length', contentLength);

  return new NextResponse(body, { status: 200, headers });
}

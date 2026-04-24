export const config = { runtime: 'edge' };

const SESSION_SECONDS = 24 * 60 * 60;

async function hmacHex(msg: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const expected = process.env.APP_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!expected || !secret) {
    return new Response(
      JSON.stringify({ ok: false, error: 'server_not_configured' }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    );
  }

  let submitted = '';
  try {
    const body = (await req.json()) as { password?: unknown };
    if (typeof body?.password === 'string') submitted = body.password;
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  // Hash both sides to a fixed-length digest, then compare in constant time.
  // This avoids leaking length information and equalises CPU cost across attempts.
  const [submittedHash, expectedHash] = await Promise.all([
    hmacHex(submitted, secret),
    hmacHex(expected, secret),
  ]);

  // Uniform 250ms delay on every attempt to slow brute-force.
  await new Promise((r) => setTimeout(r, 250));

  if (!timingSafeEqual(submittedHash, expectedHash)) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const expMs = Date.now() + SESSION_SECONDS * 1000;
  const sig = await hmacHex(String(expMs), secret);
  const token = `${expMs}.${sig}`;

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'set-cookie': `auth=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}`,
    },
  });
}

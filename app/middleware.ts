import { next } from '@vercel/edge';

export const config = {
  matcher: '/((?!_vercel|_next/static).*)',
};

const WHITELIST = new Set<string>([
  '/login',
  '/login.html',
  '/api/login',
  '/api/logout',
  '/favicon.ico',
  '/lemnisca-logo.svg',
  '/robots.txt',
]);

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

async function verifyToken(token: string, secret: string): Promise<boolean> {
  const idx = token.indexOf('.');
  if (idx < 0) return false;
  const expStr = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = await hmacHex(expStr, secret);
  return timingSafeEqual(sig, expected);
}

function parseAuthCookie(header: string | null): string | null {
  if (!header) return null;
  const m = header.match(/(?:^|;\s*)auth=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default async function middleware(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (WHITELIST.has(path)) return next();

  const token = parseAuthCookie(req.headers.get('cookie'));
  const secret = process.env.AUTH_SECRET;

  if (token && secret && (await verifyToken(token, secret))) return next();

  const accept = req.headers.get('accept') || '';
  const wantsHtml = accept.includes('text/html');
  if (wantsHtml) {
    return Response.redirect(new URL('/login.html', url.origin), 302);
  }
  return new Response('Unauthorized', { status: 401 });
}

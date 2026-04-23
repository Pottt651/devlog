// Pages 全站 auth middleware. 检查 pott_auth cookie, 无则跳 /auth/login.
// 登录 / 登出 / 静态资源（被 Pages 自己的静态处理前置）不拦截.

interface Env {
  AUTH_USER: string;
  AUTH_PASSWORD: string;
  AUTH_COOKIE_SECRET: string;
}

const SKIP_PATHS = ["/auth/login", "/auth/logout"];

function b64urlDecode(s: string): string {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return atob(s);
}

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyAuth(cookieHeader: string | null, secret: string): Promise<boolean> {
  if (!cookieHeader || !secret) return false;
  const m = cookieHeader.match(/(?:^|;\s*)pott_auth=([^;]+)/);
  if (!m) return false;
  const raw = decodeURIComponent(m[1]);
  const [payloadB64, sigHex] = raw.split(".");
  if (!payloadB64 || !sigHex) return false;
  let payload: { u: string; exp: number };
  try {
    payload = JSON.parse(b64urlDecode(payloadB64));
  } catch {
    return false;
  }
  if (!payload.u || !payload.exp) return false;
  if (Date.now() / 1000 > payload.exp) return false;
  const expected = await hmacHex(secret, `${payload.u}.${payload.exp}`);
  return expected === sigHex;
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  if (SKIP_PATHS.some((p) => url.pathname.startsWith(p))) {
    return ctx.next();
  }
  const ok = await verifyAuth(
    ctx.request.headers.get("Cookie"),
    ctx.env.AUTH_COOKIE_SECRET
  );
  if (ok) return ctx.next();
  const loginUrl = `/auth/login?next=${encodeURIComponent(ctx.request.url)}`;
  return Response.redirect(new URL(loginUrl, ctx.request.url).toString(), 302);
};

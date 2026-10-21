// work/alpha-protected/functions/_lib/portal.ts
var OWNER_EMAIL = "richermoon8050@gmail.com";
var COOKIE = "__Secure-pott_session";
async function portalSession(request, db) {
  const value = (request.headers.get("cookie") ?? "").split(";").map((v) => v.trim()).find((v) => v.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
  if (!value || !/^[a-f0-9]{64}$/.test(value)) return null;
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const hash = Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
  return db.prepare("SELECT token_hash,username,expires_at FROM portal_sessions WHERE token_hash=? AND username=? AND expires_at>?").bind(hash, OWNER_EMAIL, Math.floor(Date.now() / 1e3)).first();
}

// work/alpha-protected/functions/_middleware.ts
var headers = { "cache-control": "private, no-store", "x-content-type-options": "nosniff", "x-robots-tag": "noindex, nofollow" };
var onRequest = async (context) => {
  const { request, env } = context, url = new URL(request.url);
  if (url.hostname !== "alphamath.pott1587.xyz") return new Response(null, { status: 303, headers: { ...headers, location: "https://alphamath.pott1587.xyz" + url.pathname + url.search } });
  if (url.pathname === "/sw.js") return context.next();
  if (!["GET", "HEAD"].includes(request.method) && request.headers.get("origin") !== url.origin) return new Response('{"error":"Invalid origin"}', { status: 403, headers });
  if (["/api/auth/login", "/api/auth/password"].includes(url.pathname)) return new Response('{"error":"\u8BF7\u4F7F\u7528\u4E2A\u4EBA\u4E3B\u9875\u7684\u90AE\u7BB1\u9A8C\u8BC1\u7801\u767B\u5F55"}', { status: 405, headers: { ...headers, "content-type": "application/json; charset=utf-8" } });
  try {
    const session = await portalSession(request, env.PORTAL_DB);
    if (!session) return url.pathname.startsWith("/api/") ? new Response('{"error":"\u8BF7\u5148\u767B\u5F55\u4E2A\u4EBA\u4E3B\u9875"}', { status: 401, headers: { ...headers, "content-type": "application/json; charset=utf-8" } }) : new Response(null, { status: 303, headers: { ...headers, location: "https://pott1587.xyz/auth/login?next=%2Falphamath" } });
    if (url.pathname === "/api/auth/logout" && request.method === "POST") {
      await env.PORTAL_DB.prepare("DELETE FROM portal_sessions WHERE token_hash=?").bind(session.token_hash).run();
      const h2 = new Headers({ ...headers, "content-type": "application/json; charset=utf-8" });
      h2.append("set-cookie", `${COOKIE}=; Domain=pott1587.xyz; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
      h2.append("set-cookie", "__Host-alphamath_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
      return new Response('{"ok":true}', { headers: h2 });
    }
    const response = await context.next(), h = new Headers(response.headers);
    for (const [k, v] of Object.entries(headers)) h.set(k, v);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: h });
  } catch {
    return new Response("\u6682\u65F6\u65E0\u6CD5\u9A8C\u8BC1\u767B\u5F55\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002", { status: 503, headers });
  }
};

// work/alpha-protected/functions/_lib/auth.ts
var SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
var LOGIN_WINDOW_SECONDS = 15 * 60;
async function getAuthenticatedUser(request, env) {
  if (!await portalSession(request, env.PORTAL_DB)) return null;
  return env.DB.prepare("SELECT id,email FROM users WHERE email=?").bind(OWNER_EMAIL).first();
}
export {
  getAuthenticatedUser,
  onRequest
};

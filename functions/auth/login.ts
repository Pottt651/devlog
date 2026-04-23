interface Env {
  AUTH_USER: string;
  AUTH_PASSWORD: string;
  AUTH_COOKIE_SECRET: string;
}

function b64urlEncode(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const LOGIN_HTML = (err: string, next: string) => `<!DOCTYPE html><html lang="zh"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>登录 Pott1587</title>
<style>
  body { font-family: -apple-system, 'Segoe UI', 'PingFang SC', sans-serif;
         background: #f5f1e8; min-height: 100vh; display: flex; align-items: center;
         justify-content: center; margin: 0; padding: 16px; }
  .card { background: #fff; border-radius: 16px; padding: 32px; width: 340px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.08); }
  h1 { margin: 0 0 8px; font-size: 22px; color: #2a241b; font-weight: 600; }
  .sub { color: #8b7d6b; font-size: 13px; margin-bottom: 24px; }
  label { display: block; font-size: 12px; color: #6b5c48; margin: 12px 0 4px; }
  input[type=text], input[type=password] { width: 100%; box-sizing: border-box;
    padding: 10px 12px; border: 1px solid #e8dfc9; border-radius: 8px; font-size: 14px;
    background: #fdfaf3; color: #2a241b; }
  input:focus { outline: none; border-color: #c8704f; }
  .remember { display: flex; align-items: center; margin: 16px 0; font-size: 13px;
    color: #6b5c48; }
  .remember input { margin-right: 8px; }
  button { width: 100%; padding: 11px; background: #c8704f; color: #fff;
    border: none; border-radius: 8px; font-size: 14px; font-weight: 500;
    cursor: pointer; margin-top: 8px; }
  button:hover { background: #b05f42; }
  .error { color: #c53030; background: #fef5f5; padding: 8px 12px; border-radius: 6px;
    font-size: 13px; margin-bottom: 12px; border: 1px solid #fbd1d1; }
</style></head><body>
<form class="card" method="POST" action="/auth/login">
  <h1>Pott1587</h1>
  <div class="sub">仅限授权访问</div>
  ${err ? `<div class="error">${err}</div>` : ""}
  <input type="hidden" name="next" value="${next}">
  <label>用户名</label>
  <input type="text" name="username" autocomplete="username" required autofocus>
  <label>密码</label>
  <input type="password" name="password" autocomplete="current-password" required>
  <div class="remember">
    <input type="checkbox" name="remember" id="r" value="1">
    <label for="r" style="margin:0; font-size:13px; cursor:pointer;">记住我 30 天</label>
  </div>
  <button type="submit">登录</button>
</form>
</body></html>`;

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const next = url.searchParams.get("next") || "/";
  const err = url.searchParams.get("err") || "";
  return new Response(LOGIN_HTML(err, next), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const form = await ctx.request.formData();
  const username = String(form.get("username") || "");
  const password = String(form.get("password") || "");
  const remember = form.get("remember") === "1";
  const next = String(form.get("next") || "/");

  const userOk = timingSafeEqual(username, ctx.env.AUTH_USER);
  const passOk = timingSafeEqual(password, ctx.env.AUTH_PASSWORD);
  if (!userOk || !passOk) {
    const back = new URL("/auth/login", ctx.request.url);
    back.searchParams.set("err", "用户名或密码错误");
    back.searchParams.set("next", next);
    return Response.redirect(back.toString(), 302);
  }

  const ttl = remember ? 30 * 24 * 3600 : 24 * 3600;
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const payload = { u: username, exp };
  const payloadB64 = b64urlEncode(JSON.stringify(payload));
  const sig = await hmacHex(ctx.env.AUTH_COOKIE_SECRET, `${username}.${exp}`);
  const cookie = `pott_auth=${encodeURIComponent(payloadB64 + "." + sig)}; ` +
    `Domain=.pott1587.xyz; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ttl}`;

  // next 只允许同域跳转
  let target: string;
  try {
    const u = new URL(next, ctx.request.url);
    if (u.hostname.endsWith(".pott1587.xyz") || u.hostname === "pott1587.xyz") {
      target = u.toString();
    } else {
      target = "/";
    }
  } catch {
    target = "/";
  }

  return new Response(null, {
    status: 302,
    headers: { Location: target, "Set-Cookie": cookie },
  });
};

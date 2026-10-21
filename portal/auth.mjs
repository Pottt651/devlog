export const COOKIE = '__Secure-pott_session';
export const OWNER_EMAIL = 'richermoon8050@gmail.com';
export const COURSE_USER = 'pott1587';
export const CHALLENGE_COOKIE = '__Host-pott_challenge';
export const CANONICAL = 'https://pott1587.xyz';
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const now = () => Math.floor(Date.now()/1000);
export function safeNext(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return '/';
  const url = new URL(value, CANONICAL);
  return url.origin === CANONICAL && !url.pathname.startsWith('/auth/') ? url.pathname + url.search + url.hash : '/';
}
export function sessionToken(request) {
  const value = (request.headers.get('cookie') || '').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export async function digest(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function authenticated(request, db) {
  const token = sessionToken(request);
  if (!token) return null;
  return db.prepare('SELECT token_hash, username, device, created_at, expires_at FROM portal_sessions WHERE token_hash = ? AND expires_at > ? AND username = ?').bind(await digest(token),now(),OWNER_EMAIL).first();
}
export async function anySession(request,db){
  const token=sessionToken(request);if(!token)return null;
  return db.prepare('SELECT token_hash,username,device,created_at,expires_at FROM portal_sessions WHERE token_hash=? AND expires_at>? AND username IN (?,?)').bind(await digest(token),now(),OWNER_EMAIL,COURSE_USER).first();
}
export async function verifyCoursePassword(env,username,password){
  if(username!==COURSE_USER||!env.AUTH_PASSWORD||typeof password!=='string'||password.length>1024)return false;
  const a=await digest(password),b=await digest(env.AUTH_PASSWORD);let difference=0;
  for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);
  return difference===0;
}
export function sameOrigin(request) { return request.headers.get('origin') === new URL(request.url).origin; }
export function cookie(token, ttl) {
  return `${COOKIE}=${token}; Domain=pott1587.xyz; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ttl}`;
}
export async function createSession(env, request, remember, username=OWNER_EMAIL) {
  if(![OWNER_EMAIL,COURSE_USER].includes(username))throw new Error('Invalid session identity');
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
  const ttl = remember ? 180*86400 : 86400;
  await env.DB.prepare('INSERT INTO portal_sessions (token_hash,username,device,created_at,expires_at) VALUES (?,?,?,?,?)').bind(await digest(token),username,(request.headers.get('user-agent')||'浏览器').slice(0,250),now(),now()+ttl).run();
  return cookie(token,ttl);
}
export function challengeCookie(value,ttl=600){return `${CHALLENGE_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ttl}`;}
export function challengeToken(request){const token=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(CHALLENGE_COOKIE+'='))?.slice(CHALLENGE_COOKIE.length+1);return token&&/^[a-f0-9]{64}$/.test(token)?token:null;}
export async function codeDigest(env,nonce,code){
  const encoder=new TextEncoder();
  const key=await crypto.subtle.importKey('raw',encoder.encode(env.AUTH_COOKIE_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode('portal-otp:'+nonce+':'+code))),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function issueCode(env,request,form){
  if((form.get('email')||'').trim().toLowerCase()!==OWNER_EMAIL)return {status:403,error:'该邮箱没有私人空间的访问权限。'};
  if(!(await allowLogin(request,env.DB)))return {status:429,error:'请求过于频繁，请稍后重试。'};
  const time=now();
  const permit=await env.DB.prepare('INSERT INTO portal_otp_limits (email,last_sent,window_start,count) VALUES (?,?,?,1) ON CONFLICT(email) DO UPDATE SET last_sent=excluded.last_sent, count=CASE WHEN excluded.last_sent-window_start>=3600 THEN 1 ELSE count+1 END, window_start=CASE WHEN excluded.last_sent-window_start>=3600 THEN excluded.last_sent ELSE window_start END WHERE excluded.last_sent-last_sent>=60 AND (excluded.last_sent-window_start>=3600 OR count<10) RETURNING last_sent').bind(OWNER_EMAIL,time,time).first();
  if(!permit)return {status:429,error:'验证码已发送，请稍后再试。每次发送至少间隔 60 秒。'};
  const nonce=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
  let random;do{random=crypto.getRandomValues(new Uint32Array(1))[0];}while(random>=4294000000);
  const code=String(random%1000000).padStart(6,'0'),id=await digest(nonce);
  await env.DB.prepare('INSERT INTO portal_otp_challenges (id_hash,code_hash,expires_at,attempts,used,remember,next) VALUES (?,?,?,0,0,?,?)').bind(id,await codeDigest(env,nonce,code),time+600,form.get('remember')==='1'?1:0,safeNext(form.get('next'))).run();
  try{
    const sent=await env.MAILER.fetch('https://mailer.internal/code',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code})});
    if(!sent.ok)throw new Error('mail failed');
  }catch{await env.DB.prepare('DELETE FROM portal_otp_challenges WHERE id_hash=?').bind(id).run();return {status:503,error:'验证码邮件暂时发送失败，请稍后重试。'};}
  return {status:200,cookie:challengeCookie(nonce)};
}
export async function consumeCode(env,request,code){
  const nonce=challengeToken(request);
  if(!nonce||!/^\d{6}$/.test(code))return null;
  const hashed=await codeDigest(env,nonce,code);
  const row=await env.DB.prepare('UPDATE portal_otp_challenges SET attempts=attempts+1, used=CASE WHEN code_hash=? THEN 1 ELSE used END WHERE id_hash=? AND used=0 AND attempts<5 AND expires_at>? RETURNING code_hash,used,remember,next').bind(hashed,await digest(nonce),now()).first();
  return row&&row.used===1&&row.code_hash===hashed?row:null;
}
export async function allowLogin(request, db) {
  const key = await digest('login:'+ (request.headers.get('cf-connecting-ip')||'local'));
  const time = now();
  const row = await db.prepare('INSERT INTO portal_login_attempts (key,attempts,window_started_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN ?-window_started_at>=900 THEN 1 ELSE attempts+1 END, window_started_at=CASE WHEN ?-window_started_at>=900 THEN ? ELSE window_started_at END RETURNING attempts').bind(key,time,time,time,time).first();
  return row.attempts <= 10;
}

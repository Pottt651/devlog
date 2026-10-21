import {COOKIE,OWNER_EMAIL,COURSE_USER,anySession,verifyCoursePassword,allowLogin,sessionToken,CANONICAL,escapeHtml as esc,safeNext,authenticated,sameOrigin,cookie,createSession,challengeCookie,challengeToken,issueCode,consumeCode,now} from './auth.mjs';
const security={'cache-control':'private, no-store','x-content-type-options':'nosniff','referrer-policy':'same-origin','x-robots-tag':'noindex, nofollow','content-security-policy':"frame-ancestors 'self' https://pott1587.xyz"};
const html=(body,status=200)=>new Response(body,{status,headers:{...security,'content-type':'text/html; charset=utf-8'}});
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...security,'content-type':'application/json; charset=utf-8'}});
const redirect=(location,headers={})=>new Response(null,{status:303,headers:{...security,location,...headers}});
const wrap=body=>`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pott</title><link rel="stylesheet" href="/portal.css"><style>.panel{max-width:460px;margin:9vh auto;padding:32px;border:1px solid #dce2d7;border-radius:18px;background:#fffef9}.panel h1{font-size:28px}.panel label{display:block;margin-top:16px;font-size:14px}.panel input:not([type=checkbox]){display:block;width:100%;padding:12px;border:1px solid #cbd5c8;border-radius:8px;font:inherit;margin-top:6px}.submit{background:#2c5540;color:white;border:0;border-radius:8px;padding:12px 18px;cursor:pointer;margin-top:20px}.error{color:#972c2c}.device{padding:20px 0;border-bottom:1px solid #dce2d7;overflow-wrap:anywhere}.device p{font-size:13px}body{padding:0 16px}</style></head><body>${body}</body></html>`;
function login(next,error='',codePhase=false,status=200,mode='password') {
  const emailMode=codePhase||mode==='email';
  const tabs='<nav style="display:flex;gap:24px;margin:20px 0"><a href="/auth/login?mode=password&next='+encodeURIComponent(next)+'">账号</a><a href="/auth/login?mode=email&next='+encodeURIComponent(next)+'">邮箱</a></nav>';
  const remember='<label><input type="checkbox" name="remember" value="1" checked> 保持登录 180 天</label>';
  const target='<input type="hidden" name="next" value="'+esc(next)+'">';
  const form=codePhase?'<form method="post" action="/auth/verify"><label>验证码<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required autofocus></label><button class="submit">登录</button></form><p><a href="/auth/login?mode=email&next='+encodeURIComponent(next)+'">重新发送</a></p>':emailMode?'<form method="post" action="/auth/send-code">'+target+'<label>邮箱<input name="email" type="email" autocomplete="email" required maxlength="200" autofocus></label>'+remember+'<button class="submit">发送验证码</button></form>':'<form method="post" action="/auth/password">'+target+'<label>账号<input name="username" value="pott1587" autocomplete="username" required maxlength="100"></label><label>密码<input name="password" type="password" autocomplete="current-password" required maxlength="1024" autofocus></label>'+remember+'<button class="submit">登录</button></form>';
  return html(wrap('<section class="panel"><span class="brand"><span class="mark">P</span>Pott</span><h1 style="margin-top:28px">登录</h1>'+tabs+(error?'<p class="error" role="alert">'+esc(error)+'</p>':'')+form+'</section>'),status);
}
function protect(response) {const headers=new Headers(response.headers);for(const [k,v] of Object.entries(security))headers.set(k,v);return new Response(response.body,{status:response.status,statusText:response.statusText,headers});}
async function boundedText(request,limit=8192) {
  if(Number(request.headers.get('content-length')||0)>limit) return null;
  if(!request.body)return '';
  const reader=request.body.getReader(),chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();return null;}chunks.push(value);}
  const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}
  return new TextDecoder().decode(data);
}
async function proxy863(request,env) {
  const url=new URL(request.url);url.pathname=url.pathname.slice('/etf-b863'.length);
  return env.ETF_SERVICE.fetch(new Request(url,request));
}
async function proxyCourses(request) {
  const incoming=new URL(request.url),upstream=new URL('https://pott-courseware.pages.dev');
  upstream.pathname=incoming.pathname.slice('/prepare'.length)||'/';upstream.search=incoming.search;
  const response=await fetch(new Request(upstream,{method:request.method,headers:{cookie:COOKIE+'='+sessionToken(request),...(request.headers.has('range')?{range:request.headers.get('range')}:{})},redirect:'manual'}));
  const headers=new Headers(response.headers);
  if(headers.has('location')){const target=new URL(headers.get('location'),upstream);if(target.origin===upstream.origin)headers.set('location','/prepare'+target.pathname+target.search);}
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
async function homepage(request,env,session){
  const source=await boundedText(await env.ASSETS.fetch(request),100000);
  if(source===null)throw new Error('Homepage too large');
  const actions=(session.username===OWNER_EMAIL?'<a href="/auth/devices">设备</a>':'')+'<form method="post" action="/auth/switch"><button class="text-button">切换账号</button></form><form method="post" action="/auth/logout"><button class="text-button">退出</button></form>';
  let page=source.replace('<!--AUTH_ACTIONS-->',actions);
  if(session.username!==OWNER_EMAIL)page=page.replace(/<!--PRIVATE_START-->[\s\S]*?<!--PRIVATE_END-->/g,'').replace('class="cards"','class="cards single-card"');
  return html(page);
}
export async function handle(request,env,ctx) {
  const url=new URL(request.url),path=url.pathname;
  if(!['pott1587.xyz','localhost','127.0.0.1'].includes(url.hostname))return redirect(CANONICAL+path+url.search);
  if(path==='/portal.css'||path==='/favicon.svg')return env.ASSETS.fetch(request);
  if(path==='/robots.txt')return new Response('User-agent: *\nDisallow: /\n',{headers:{'content-type':'text/plain'}});
  if(!['GET','HEAD'].includes(request.method)&&!sameOrigin(request))return json({error:'请求来源不符，请从网站内操作。'},403);
  if(path==='/auth/login') {
    const next=safeNext(url.searchParams.get('next'));
    if(request.method==='GET')return login(next,'',url.searchParams.get('sent')==='1'&&Boolean(challengeToken(request)),200,url.searchParams.get('mode')==='password'?'password':'email');
    return json({error:'请使用邮箱验证码登录'},405);
  }
  if(path==='/auth/password'){
    if(request.method!=='POST')return json({error:'Method not allowed'},405);
    const text=await boundedText(request);if(text===null)return json({error:'请求过大'},413);
    const form=new URLSearchParams(text);
    if(!await allowLogin(request,env.DB))return login('/','尝试过于频繁，请稍后重试。',false,429);
    if(!await verifyCoursePassword(env,form.get('username'),form.get('password')))return login('/','账号或密码不正确。',false,401);
    const target=safeNext(form.get('next'));
    return redirect(target.startsWith('/prepare/')?target:'/',{'set-cookie':await createSession(env,request,form.get('remember')==='1',COURSE_USER)});
  }
  if(path==='/auth/send-code'||path==='/auth/verify'){
    if(request.method!=='POST')return json({error:'Method not allowed'},405);
    if(!env.AUTH_COOKIE_SECRET||!env.MAILER)return login('/','邮箱登录尚未配置。',false,503);
    const text=await boundedText(request);if(text===null)return json({error:'请求过大'},413);
    const form=new URLSearchParams(text),target=safeNext(form.get('next'));
    if(path==='/auth/send-code'){
      const result=await issueCode(env,request,form);
      if(result.status!==200)return login(target,result.error,false,result.status,'email');
      return redirect('/auth/login?sent=1&next='+encodeURIComponent(target),{'set-cookie':result.cookie});
    }
    const challenge=await consumeCode(env,request,form.get('code')||'');
    if(!challenge)return login('/','验证码不正确、已过期或已使用，请重试或重新发送。',true,401);
    const response=redirect(safeNext(challenge.next),{'set-cookie':await createSession(env,request,Boolean(challenge.remember))});
    response.headers.append('set-cookie',challengeCookie('',0));
    ctx.waitUntil(env.DB.batch([env.DB.prepare('DELETE FROM portal_sessions WHERE expires_at<=?').bind(now()),env.DB.prepare('DELETE FROM portal_login_attempts WHERE window_started_at<?').bind(now()-86400),env.DB.prepare('DELETE FROM portal_otp_challenges WHERE expires_at<?').bind(now()-86400)]));
    return response;
  }
  const session=await anySession(request,env.DB);
  if((path==='/'||path==='/index.html')&&['GET','HEAD'].includes(request.method))return session?homepage(request,env,session):login('/');
  if(!session){if(path.startsWith('/api/')||path==='/auth/session'||path.includes('/api/'))return json({error:'请先登录'},401);return redirect('/auth/login?next='+encodeURIComponent(safeNext(path+url.search)));}
  if(path==='/prepare')return redirect('/prepare/');
  if(path.startsWith('/prepare/')){if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed'},405);return protect(await proxyCourses(request));}
  if(path==='/auth/session')return json({authenticated:true,username:session.username,role:session.username===OWNER_EMAIL?'owner':'course'});
  if((path==='/auth/logout'||path==='/auth/switch')&&request.method==='POST'){await env.DB.prepare('DELETE FROM portal_sessions WHERE token_hash=?').bind(session.token_hash).run();return redirect(path==='/auth/switch'?'/auth/login':'/',{'set-cookie':cookie('',0)});}
  if(path==='/auth/devices'&&request.method==='GET'){
    const result=await env.DB.prepare('SELECT token_hash,device,created_at,expires_at FROM portal_sessions WHERE username=? AND expires_at>? ORDER BY created_at DESC').bind(session.username,now()).all();
    const rows=result.results.map(row=>`<article class="device"><strong>${row.token_hash===session.token_hash?'当前设备':'已登录设备'}</strong><p>${esc(row.device)}</p><p>登录于 ${esc(new Date(row.created_at*1000).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}))}</p><form method="post" action="/auth/revoke"><input type="hidden" name="id" value="${esc(row.token_hash)}"><button class="submit">退出这台设备</button></form></article>`).join('');
    return html(wrap(`<main style="max-width:750px"><a href="/">← 返回主页</a><h1 style="margin-top:24px">登录设备</h1>${rows}</main>`));
  }
  if(path==='/auth/revoke'&&request.method==='POST') {const text=await boundedText(request);if(text===null)return json({error:'请求过大'},413);const form=new URLSearchParams(text);const id=String(form.get('id')||'');await env.DB.prepare('DELETE FROM portal_sessions WHERE token_hash=? AND username=?').bind(id,session.username).run();return redirect(id===session.token_hash?'/auth/login':'/auth/devices',id===session.token_hash?{'set-cookie':cookie('',0)}:{});}
  if(session.username!==OWNER_EMAIL){if(path.includes('/api/'))return json({error:'无访问权限'},403);return html(wrap('<section class="panel"><h1>无访问权限</h1><form method="post" action="/auth/switch"><button class="submit">切换账号</button></form><p><a href="/">返回主页</a></p></section>'),403);}
  if(path==='/alphamath'||path==='/alphamath/')return redirect('https://alphamath.pott1587.xyz/');
  if(path==='/etf-b863')return redirect('/etf-b863/');
  if(path.startsWith('/etf-b863/api/'))return protect(await proxy863(request,env));
  if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed'},405);
  if(path.startsWith('/etf-b863/'))return protect(await env.ASSETS.fetch(request));
  return html(wrap('<section class="panel"><h1>页面已停用</h1><p><a href="/">返回私人主页</a></p></section>'),404);
}
export default {async fetch(request,env,ctx){try{return await handle(request,env,ctx);}catch{console.error(JSON.stringify({event:'portal_request_failed',path:new URL(request.url).pathname}));return html(wrap('<section class="panel"><h1>暂时无法打开</h1><p>请稍后重试。</p></section>'),503);}}};

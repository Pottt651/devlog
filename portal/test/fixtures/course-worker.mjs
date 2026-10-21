const headers={'cache-control':'private, no-store','x-robots-tag':'noindex, nofollow','x-content-type-options':'nosniff','referrer-policy':'same-origin','content-security-policy':"frame-ancestors 'self' https://pott1587.xyz"};
async function authenticated(request,db){
  const token=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('__Secure-pott_session='))?.slice('__Secure-pott_session='.length);
  if(!token||!/^[a-f0-9]{64}$/.test(token))return false;
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('');
  return Boolean(await db.prepare('SELECT token_hash FROM portal_sessions WHERE token_hash=? AND username IN (?,?) AND expires_at>?').bind(hash,'richermoon8050@gmail.com','pott1587',Math.floor(Date.now()/1000)).first());
}
export default {async fetch(request,env){
  try {
    const url=new URL(request.url);
    if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers});
    if(!await authenticated(request,env.PORTAL_DB))return new Response(null,{status:303,headers:{...headers,location:'https://pott1587.xyz/auth/login?next='+encodeURIComponent('/prepare'+url.pathname+url.search)}});
    const result=await env.ASSETS.fetch(request),out=new Headers(result.headers);
    for(const [key,value] of Object.entries(headers))out.set(key,value);
    return new Response(result.body,{status:result.status,statusText:result.statusText,headers:out});
  }catch{return new Response('课件暂时无法打开，请稍后重试。',{status:503,headers:{...headers,'cache-control':'no-store'}});}
}};

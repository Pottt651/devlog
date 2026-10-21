import {authenticated} from './auth.mjs';

export async function gate(request,env) {
  const url=new URL(request.url),path=url.pathname;
  // Existing automation keeps its existing, explicitly configured tokens.
  const write=request.headers.get('x-write-token');
  if(path.startsWith('/api/')&&env.WRITE_TOKEN&&write===env.WRITE_TOKEN)return true;
  const adminPaths=['freeze','backfill','send-report','send-daily','d1-import'].map(x=>'/api/admin/'+x);
  if(adminPaths.includes(path)&&env.ADMIN_TOKEN&&url.searchParams.get('token')===env.ADMIN_TOKEN)return true;
  if(!['GET','HEAD'].includes(request.method)&&request.headers.get('origin')!=='https://pott1587.xyz')return false;
  return Boolean(await authenticated(request,env.PORTAL_DB));
}
export function secured(handler) {return {
  async fetch(request,env,ctx) {
    try {
      if(!(await gate(request,env)))return new Response('{"error":"请先登录私人主页"}',{status:401,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}});
      const response=await handler.fetch(request,env,ctx),headers=new Headers(response.headers);
      headers.set('cache-control','private, no-store');headers.delete('access-control-allow-origin');headers.delete('access-control-allow-credentials');
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    }catch{return new Response('{"error":"暂时无法验证登录"}',{status:503,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}});}
  },
  scheduled(event,env,ctx){return handler.scheduled(event,env,ctx);}
};}

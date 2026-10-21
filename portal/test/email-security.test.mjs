import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {handle} from '../worker.mjs';
import {OWNER_EMAIL,authenticated,digest,safeNext} from '../auth.mjs';
import {gate,secured} from '../secured-863.mjs';
import {onRequest as alphaGuard,getAuthenticatedUser as alphaUser} from './fixtures/alpha-guard.mjs';
import courseWorker from './fixtures/course-worker.mjs';
function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
 const db={prepare(query){let args=[];return {bind(...v){args=v;return this;},async first(){return sql.prepare(query).get(...args)||null;},async all(){return {results:sql.prepare(query).all(...args)};},async run(){return sql.prepare(query).run(...args);}};},async batch(a){return Promise.all(a.map(s=>s.run()));}};
 const sent=[],pending=[];
 const env={DB:db,AUTH_COOKIE_SECRET:'only-a-test-key',MAILER:{async fetch(url,init){sent.push(JSON.parse(init.body).code);return new Response(null,{status:204});}},ASSETS:{async fetch(){return new Response(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'));}}};
 const ctx={waitUntil(p){pending.push(p);}};
 const req=(path,method='GET',body='',cookie='')=>new Request('https://pott1587.xyz'+path,{method,headers:{...(method==='POST'?{origin:'https://pott1587.xyz','content-type':'application/x-www-form-urlencoded'}:{}),...(cookie?{cookie}:{})},...(method==='POST'?{body}:{})});
 const send=async()=>{const r=await handle(req('/auth/send-code','POST',new URLSearchParams({email:OWNER_EMAIL,remember:'1',next:'/'}).toString()),env,ctx);assert.equal(r.status,303);return r.headers.get('set-cookie').split(';')[0];};
 const signin=async()=>{const challenge=await send();const r=await handle(req('/auth/verify','POST','code='+sent.at(-1),challenge),env,ctx);assert.equal(r.status,303);await Promise.all(pending);return {challenge,response:r,token:r.headers.getSetCookie().find(x=>x.startsWith('__Secure-pott_session=')).split(';')[0]};};
 return {sql,env,ctx,req,sent,pending,send,signin};
}
test('AlphaMath only shares verified owner sessions and protects direct assets and aliases',async()=>{
 const a=setup(),{token}=await a.signin();
 a.sql.exec('CREATE TABLE users(id TEXT,email TEXT)');a.sql.prepare('INSERT INTO users VALUES (?,?)').run('existing-owner-id',OWNER_EMAIL);
 const env={DB:a.env.DB,PORTAL_DB:a.env.DB};let served=0;
 const req=(path,session='',method='GET',origin='https://alphamath.pott1587.xyz')=>new Request('https://alphamath.pott1587.xyz'+path,{method,headers:{cookie:session,origin}});
 const run=request=>alphaGuard({request,env,next:async()=>{served++;return new Response('private student app');}});
 assert.equal((await run(req('/'))).status,303);
 assert.equal((await run(req('/assets/app.js'))).status,303);
 assert.equal((await run(req('/api/data/query'))).status,401);
 assert.equal(served,0);
 assert.equal((await run(req('/api/auth/login','', 'POST'))).status,405);
 assert.equal((await run(req('/api/data/query',token,'POST','https://other.example'))).status,403);
 assert.equal((await alphaUser(req('/api/auth/session','__Host-alphamath_session=legacy'),env)),null);
 assert.deepEqual({...await alphaUser(req('/api/auth/session',token),env)},{id:'existing-owner-id',email:OWNER_EMAIL});
 const response=await run(req('/',token));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
 assert.equal((await alphaGuard({request:new Request('https://old.alphamath-teacher-os.pages.dev/'),env,next:()=>{throw Error('must not serve');}})).headers.get('location'),'https://alphamath.pott1587.xyz/');
 const logout=await run(req('/api/auth/logout',token,'POST'));assert.equal(logout.status,200);
 assert.equal(await alphaUser(req('/api/auth/session',token),env),null);
});
test('AlphaMath fails closed when session verification is unavailable',async()=>{
 const request=new Request('https://alphamath.pott1587.xyz/',{headers:{cookie:'__Secure-pott_session='+'a'.repeat(64)}});
 assert.equal((await alphaGuard({request,env:{PORTAL_DB:{prepare(){throw Error('offline');}}},next(){throw Error('must not serve');}})).status,503);
});
test('homepage is login screen and all course paths require a session',async()=>{
 const {env,ctx,req}=setup();
 for(const path of ['/','/index.html']){const r=await handle(req(path),env,ctx);assert.equal(r.status,200);const body=await r.text();assert.match(body,/action="\/auth\/password"/);assert.doesNotMatch(body,/href="\/prepare\/"/);}
 for(const path of ['/prepare','/prepare/','/prepare/lesson.html','/prepare/exam.pdf','/prepare/version.json'])assert.equal((await handle(req(path),env,ctx)).status,303);
 for(const path of ['/alphamath','/etf-b863/'])assert.equal((await handle(req(path),env,ctx)).status,303);
 assert.equal((await handle(req('/etf-b863/api/state'),env,ctx)).status,401);
});
test('only owner email can request codes; password and cross-origin login are rejected',async()=>{
 const {env,ctx,req,sent}=setup();assert.equal((await handle(req('/auth/send-code','POST','email=other%40example.com'),env,ctx)).status,403);assert.equal(sent.length,0);
 assert.equal((await handle(req('/auth/login','POST','username=pott1587&password=anything'),env,ctx)).status,405);
 assert.equal((await handle(new Request('https://pott1587.xyz/auth/send-code',{method:'POST',headers:{origin:'https://bad.example'},body:'email='+OWNER_EMAIL}),env,ctx)).status,403);
});
test('email proof creates 180-day owner session and cannot be reused',async()=>{
 const {env,ctx,req,signin,sent,sql}=setup(),{token,challenge,response}=await signin();
 assert.match(response.headers.getSetCookie()[0],/HttpOnly; Secure; SameSite=Lax; Max-Age=15552000/);
 assert.equal((await authenticated(req('/','GET','',token),env.DB)).username,OWNER_EMAIL);
 const body=await (await handle(req('/','GET','',token),env,ctx)).text();assert.match(body,/href="\/alphamath"/);assert.match(body,/href="\/etf-b863\/"/);assert.doesNotMatch(body,/oyboss/);
 assert.equal((await handle(req('/auth/verify','POST','code='+sent.at(-1),challenge),env,ctx)).status,401);
 const saved=sql.prepare('SELECT * FROM portal_otp_challenges').get();assert.notEqual(saved.code_hash,sent.at(-1));assert.notEqual(saved.id_hash,challenge.split('=')[1]);
});
test('wrong codes lock after five attempts and sends are throttled',async()=>{
 const {env,ctx,req,send,sent}=setup(),nonce=await send(),wrong=sent[0]==='000000'?'111111':'000000';
 assert.equal((await handle(req('/auth/send-code','POST','email='+OWNER_EMAIL),env,ctx)).status,429);
 for(let i=0;i<5;i++)assert.equal((await handle(req('/auth/verify','POST','code='+wrong,nonce),env,ctx)).status,401);
 assert.equal((await handle(req('/auth/verify','POST','code='+sent[0],nonce),env,ctx)).status,401);
});
test('expired challenge and revoked device cannot authorize access',async()=>{
 const a=setup(),nonce=await a.send();a.sql.exec('UPDATE portal_otp_challenges SET expires_at=1');assert.equal((await handle(a.req('/auth/verify','POST','code='+a.sent[0],nonce),a.env,a.ctx)).status,401);
 const b=setup(),{token}=await b.signin(),saved=b.sql.prepare('SELECT token_hash FROM portal_sessions').get();
 await handle(b.req('/auth/revoke','POST','id='+saved.token_hash,token),b.env,b.ctx);assert.equal(await authenticated(b.req('/','GET','',token),b.env.DB),null);
});
test('switch login revokes current session and clears cookie',async()=>{
 const {env,ctx,req,signin}=setup(),{token}=await signin(),r=await handle(req('/auth/switch','POST','',token),env,ctx);assert.equal(r.headers.get('location'),'/auth/login');assert.match(r.headers.get('set-cookie'),/Max-Age=0/);assert.equal(await authenticated(req('/','GET','',token),env.DB),null);
});
test('old password sessions fail the email-only guard',async()=>{
 const {env,req,sql}=setup(),raw='a'.repeat(64);sql.prepare('INSERT INTO portal_sessions VALUES (?,?,?,?,?)').run(await digest(raw),'pott1587','old device',1,9999999999);
 assert.equal(await gate(req('/api/state','GET','','__Secure-pott_session='+raw),{PORTAL_DB:env.DB}),false);
});
test('private course proxy forwards only the validated portal cookie',async()=>{
 const {env,ctx,req,signin}=setup(),{token}=await signin(),previous=globalThis.fetch;let upstream;
 try{globalThis.fetch=async r=>{upstream=r;return new Response('lesson');};const r=await handle(req('/prepare/test.html','GET','',token+'; other=secret'),env,ctx);assert.equal(await r.text(),'lesson');assert.equal(upstream.headers.get('cookie'),token);assert.equal(upstream.url,'https://pott-courseware.pages.dev/test.html');}finally{globalThis.fetch=previous;}
});
test('course password grants course access but cannot access owner modules or direct origins',async()=>{
 const a=setup();a.env.AUTH_PASSWORD='test-course-password';
 const bad=await handle(a.req('/auth/password','POST','username=richermoon8050%40gmail.com&password=test-course-password'),a.env,a.ctx);assert.equal(bad.status,401);
 const r=await handle(a.req('/auth/password','POST','username=pott1587&password=test-course-password&remember=1'),a.env,a.ctx);assert.equal(r.status,303);
 const token=r.headers.get('set-cookie').split(';')[0];assert.match(r.headers.get('set-cookie'),/Max-Age=15552000/);
 const home=await (await handle(a.req('/','GET','',token),a.env,a.ctx)).text();assert.match(home,/href="\/prepare\/"/);assert.doesNotMatch(home,/href="\/(alphamath|etf-b863|oyboss)/);
 for(const path of ['/alphamath','/etf-b863/','/etf-b863/api/state'])assert.equal((await handle(a.req(path,'GET','',token),a.env,a.ctx)).status,403);
 assert.equal(await gate(a.req('/api/state','GET','',token),{PORTAL_DB:a.env.DB}),false);
 assert.equal(await alphaUser(new Request('https://alphamath.pott1587.xyz/api/auth/session',{headers:{cookie:token}}),{PORTAL_DB:a.env.DB,DB:a.env.DB}),null);
 const courseEnv={PORTAL_DB:a.env.DB,ASSETS:{fetch:async()=>new Response('private lesson')}};
 for(const path of ['/','/lesson.html','/exam.pdf']){
  const request=new Request('https://pott-courseware.pages.dev'+path,{headers:{cookie:token}});
  assert.equal((await courseWorker.fetch(request,courseEnv)).status,200);
  assert.equal((await courseWorker.fetch(new Request(request.url),courseEnv)).status,303);
 }
 await handle(a.req('/auth/logout','POST','',token),a.env,a.ctx);
 assert.equal((await courseWorker.fetch(new Request('https://pott-courseware.pages.dev/',{headers:{cookie:token}}),courseEnv)).status,303);
});
test('mail failure leaves no valid challenge or session',async()=>{
 const {env,ctx,req,sql}=setup();env.MAILER.fetch=async()=>new Response(null,{status:503});const r=await handle(req('/auth/send-code','POST','email='+OWNER_EMAIL),env,ctx);assert.equal(r.status,503);assert.equal(sql.prepare('SELECT count(*) n FROM portal_otp_challenges').get().n,0);assert.equal(r.headers.get('set-cookie'),null);
});
test('863 preserves authorized automation and cron, denies anonymous reads',async()=>{
 const {env,req}=setup(),bindings={PORTAL_DB:env.DB,WRITE_TOKEN:'test-machine-token'};let count=0;
 const handler=secured({fetch:async()=>new Response('ok'),scheduled:()=>count++});assert.equal((await handler.fetch(req('/api/state'),bindings,{})).status,401);
 assert.equal(await gate(new Request('https://worker.invalid/api/user/qmt-sync',{method:'POST',headers:{'x-write-token':'test-machine-token'}}),bindings),true);handler.scheduled({},bindings,{});assert.equal(count,1);
});
test('redirects and login request size remain bounded',async()=>{
 for(const x of ['//bad.example','https://bad.example','/\\bad.example','/auth/login','/\r\nLocation:bad'])assert.equal(safeNext(x),'/');
 const {env,ctx,req}=setup();assert.equal((await handle(req('/auth/send-code','POST','x'.repeat(8193)),env,ctx)).status,413);
});

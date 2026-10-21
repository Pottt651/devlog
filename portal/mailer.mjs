import {EmailMessage} from 'cloudflare:email';
const recipient='richermoon8050@gmail.com',sender='login@pott1587.xyz';
export default {async fetch(request,env){
  if(request.method!=='POST'||new URL(request.url).pathname!=='/code')return new Response(null,{status:404});
  const body=await request.text();if(body.length>100)return new Response(null,{status:413});
  let code;try{code=JSON.parse(body).code;}catch{return new Response(null,{status:400});}
  if(typeof code!=='string'||!/^\d{6}$/.test(code))return new Response(null,{status:400});
  const boundary='pott-'+crypto.randomUUID();
  const raw=[`From: Pott Workspace <${sender}>`,`To: <${recipient}>`,'Subject: Pott sign-in verification code',`Date: ${new Date().toUTCString()}`,`Message-ID: <${crypto.randomUUID()}@pott1587.xyz>`,'MIME-Version: 1.0',`Content-Type: multipart/alternative; boundary="${boundary}"`,'',`--${boundary}`,'Content-Type: text/plain; charset=UTF-8','','Your Pott sign-in code: '+code+'.','It expires in 10 minutes and can be used only once. If you did not request it, ignore this email.',`--${boundary}`,'Content-Type: text/html; charset=UTF-8','','<h2>Pott Workspace</h2><p>Your sign-in code:</p><p style="font-size:32px;letter-spacing:8px">'+code+'</p><p>Valid for 10 minutes. If you did not request it, ignore this email.</p>',`--${boundary}--`,''].join('\r\n');
  try{await env.EMAIL.send(new EmailMessage(sender,recipient,raw));return new Response(null,{status:204});}
  catch{console.error('portal_email_send_failed');return new Response(null,{status:503});}
}};

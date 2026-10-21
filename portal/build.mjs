import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const dest=path.join(root,'dist');
if(path.dirname(dest)!==root||path.basename(dest)!=='dist')throw new Error('Unsafe output path');
if(fs.existsSync(dest)&&fs.realpathSync(dest)!==dest)throw new Error('Output path resolves elsewhere');
fs.rmSync(dest,{recursive:true,force:true});fs.mkdirSync(dest,{recursive:true});
const dashboard=path.resolve(root,'../live/dashboard-assets');
fs.cpSync(path.join(dashboard,'etf-b863'),path.join(dest,'etf-b863'),{recursive:true});
for(const name of fs.readdirSync(path.join(dest,'etf-b863/assets'))){
  if(name.endsWith('.js')){const target=path.join(dest,'etf-b863/assets',name);fs.writeFileSync(target,fs.readFileSync(target,'utf8').replaceAll('https://etf-b863.richermoon8050.workers.dev','/etf-b863'));}
}
const dashboardHtml=fs.readFileSync(path.join(dashboard,'index.html'),'utf8').replace('</body>','<a href="/" style="position:fixed;bottom:8px;left:8px;z-index:9999;padding:5px 10px;border-radius:6px;background:#f5f5ef;color:#21372d;font:12px system-ui">返回主页</a></body>');
fs.writeFileSync(path.join(dest,'etf-b863/index.html'),dashboardHtml);
for(const name of ['index.html','portal.css'])fs.copyFileSync(path.join(root,name),path.join(dest,name));
fs.writeFileSync(path.join(dest,'favicon.svg'),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="13" fill="#2c5540"/><text x="24" y="33" text-anchor="middle" font-family="system-ui" font-size="31" fill="#fff">P</text></svg>');
fs.writeFileSync(path.join(dest,'_routes.json'),JSON.stringify({version:1,include:['/*'],exclude:[]}));
const auth=fs.readFileSync(path.join(root,'auth.mjs'),'utf8').replace(/^export /gm,'');
const worker=fs.readFileSync(path.join(root,'worker.mjs'),'utf8').replace(/^import[^\n]+\n/,'').replace('export async function handle','async function handle');
fs.writeFileSync(path.join(dest,'_worker.js'),auth+'\nconst esc=escapeHtml;\n'+worker);
console.log(JSON.stringify({portal:true,courses:'automatic Git deployment'}));

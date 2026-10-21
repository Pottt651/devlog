import fs from 'node:fs';
import path from 'node:path';
const origin='https://etf-b863.pages.dev';
const dest=path.resolve('work/live/dashboard-assets');
fs.mkdirSync(dest,{recursive:true});
const pending=['/'],seen=new Set();
while(pending.length){const name=pending.shift();if(seen.has(name))continue;seen.add(name);
 const response=await fetch(origin+name);if(!response.ok)throw Error(`${name}: ${response.status}`);
 let content=await response.text();if(content.length>2_000_000)throw Error('Unexpected asset size');
 if(name==='/')content=content.replace(/<script>window\.__INITIAL_STATE__\s*=[\s\S]*?<\/script>/g,'');
 const refs=[...content.matchAll(/(?:src|href)=["']([^"']+)["']/g),...content.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g),...content.matchAll(/@import\s*["']([^"']+)["']/g)];
 for(const ref of refs){let url;try{url=new URL(ref[1],origin+(name==='/'?'/index.html':name));}catch{continue;}if(url.origin===origin&&/^\/(?:src|etf-b863\/assets)\//.test(url.pathname)&&/\.(js|css)$/.test(url.pathname))pending.push(url.pathname);}
 const relative=name==='/'?'index.html':name.slice(1);if(relative.includes('..'))throw Error('Invalid asset path');
 const filename=path.join(dest,relative);fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,content);
}
fs.writeFileSync(path.join(dest,'asset-manifest.json'),JSON.stringify([...seen],null,2));
console.log(JSON.stringify({assets:seen.size,saved:dest}));

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'dist');
http.createServer((req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let target=path.resolve(root,'.'+pathname);if(!target.startsWith(root+path.sep)&&target!==root)throw Error();if(path.basename(target).startsWith('_'))throw Error();if(fs.statSync(target).isDirectory())target=path.join(target,'index.html');const type={'.html':'text/html; charset=utf-8','.css':'text/css','.svg':'image/svg+xml','.pdf':'application/pdf'}[path.extname(target)];if(!type)throw Error();res.writeHead(200,{'content-type':type,'cache-control':'no-store'});fs.createReadStream(target).pipe(res);}catch{res.writeHead(404);res.end('Local preview: this service is not connected.');}}).listen(4173,'127.0.0.1',()=>console.log('Read-only visual preview: http://127.0.0.1:4173'));

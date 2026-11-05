import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('www');
createServer(async(req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/\/$/,'/index.html'));if(!path.startsWith(root+sep))throw Error();const data=await readFile(path);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.png':'image/png'})[extname(path)]||'application/octet-stream');res.end(data);}catch{res.writeHead(404);res.end();}}).listen(4173,'127.0.0.1',()=>console.log('http://127.0.0.1:4173'));

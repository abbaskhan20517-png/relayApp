import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {database} from './sqlite.mjs';
import {handle} from '../lib/api.js';
import {store} from '../lib/store.js';
import {processEscalations} from '../lib/leads.js';
import {processNotifications} from '../lib/providers.js';
import {build} from 'esbuild';
mkdirSync('.local',{recursive:true});
await build({entryPoints:['scripts/local-entry.tsx'],bundle:true,outfile:'.local/app.js',platform:'browser',format:'esm',jsx:'automatic',minify:true,loader:{'.css':'css'}});
const db=database('.local/relay.sqlite'),env={...process.env,DB:db,APP_URL:process.env.APP_URL||'http://127.0.0.1:5173'};
let working=false;const tick=async()=>{if(working)return;working=true;try{await processEscalations(store(db));await processNotifications(store(db),env);}catch(e){console.error('Background worker failed:',e.message);}finally{working=false;}};
const timer=setInterval(tick,5000);tick();
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,env.APP_URL);if(url.pathname.startsWith('/api/')){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1000000){res.writeHead(413);res.end('Request too large');return;}chunks.push(chunk);}const r=await handle(new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})}),env);res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));return;}
 const file=url.pathname==='/app.js'?'.local/app.js':url.pathname==='/app.css'?'.local/app.css':null;
 if(file){res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');res.end(readFileSync(file));return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Relay — Your business, connected</title><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');
 }catch(e){console.error(e.message);res.writeHead(500);res.end('Unable to complete request.');}});
server.listen(Number(process.env.PORT||5173),'127.0.0.1',()=>console.log('Relay ready at '+env.APP_URL+' · persistent SQLite · worker every 5s'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{clearInterval(timer);server.close(()=>{db.close();process.exit(0);});});

import {database} from './sqlite.mjs';import {handle} from '../lib/api.js';import {store} from '../lib/store.js';import {password,uid} from '../lib/security.js';
import {mkdirSync} from 'node:fs';
if(!process.env.SEED_PASSWORD||process.env.SEED_PASSWORD.length<10)throw new Error('Set SEED_PASSWORD to a development-only password of at least 10 characters.');
mkdirSync('.local',{recursive:true});const db=database('.local/relay.sqlite'),env={DB:db,APP_URL:'http://127.0.0.1:5173',NODE_ENV:'test'};
for(const [name,company] of [['Alex Morgan','Northstar Services'],['Jamie Chen','Brightline Solar']]){
 const email=name.split(' ')[0].toLowerCase()+'@relay.example';if(await store(db).one('SELECT id FROM users WHERE email=?',email)){console.log('Already seeded:',email);continue;}
 const r=await handle(new Request(env.APP_URL+'/api/auth/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,workspace:company,email,password:process.env.SEED_PASSWORD})}),env);if(!r.ok)throw new Error(await r.text());const user=(await r.json()).user;const cookie=r.headers.get('set-cookie').split(';')[0];const demo=await handle(new Request(env.APP_URL+'/api/demo',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:'{}'}),env);if(!demo.ok)throw new Error(await demo.text());
 const owner=await store(db).one('SELECT workspace FROM users WHERE id=?',user.id);const pw=await password(process.env.SEED_PASSWORD);for(const [employee,role,status] of [['Sam Rivera','Manager','Available'],['Taylor Kim','User','Busy'],['Jordan Lee','Admin','Offline']]){const id=uid();await db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,owner.workspace,employee.split(' ')[0].toLowerCase()+'.'+name.split(' ')[0].toLowerCase()+'@relay.example',employee,pw,role,status,8,'','Asia/Karachi','{}',1).run();}
 console.log('Seeded:',company,'Owner:',email);
}
db.close();console.log('Local demo data only. No providers were called. Password is the supplied SEED_PASSWORD.');

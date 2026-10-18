import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from '../scripts/sqlite.mjs';
import {store} from '../lib/store.js';
import {sendMessage} from '../lib/providers.js';
import {seal} from '../lib/security.js';
import {handle} from '../lib/api.js';

test('Twilio enforces reply windows, sends templates and labels SMS correctly',async()=>{
 const db=database(),env={DB:db,APP_URL:'http://localhost',SECRET_KEY:'test-secret',NODE_ENV:'test'};
 const response=await handle(new Request('http://localhost/api/auth/signup',{method:'POST',headers:{Origin:env.APP_URL,'Content-Type':'application/json'},body:JSON.stringify({name:'Messaging',workspace:'Messaging',email:'messaging@example.com',password:'TestPassword12345!'})}),env);
 assert.equal(response.status,200);
 const cookie=response.headers.get('set-cookie').split(';')[0];
 const state=await (await handle(new Request('http://localhost/api/state',{headers:{Cookie:cookie}}),env)).json();
 const s=store(db),w=state.workspace.id,user=state.user,contact={id:'messaging-contact',name:'Recipient',phone:'+15550004444'};
 await s.insert(w,'contacts',contact,contact.id).run();
 const configure=async from=>db.prepare('INSERT OR REPLACE INTO credentials VALUES(?,?,?,?,?)').bind('messaging-twilio',w,'twilio',await seal({sid:'ACfixture',token:'fixture',from},env.SECRET_KEY),Date.now()).run();
 await configure('whatsapp:+15550005555');
 const original=globalThis.fetch;const requests=[];
 globalThis.fetch=async(url,options)=>{requests.push(new URLSearchParams(options.body));return new Response(JSON.stringify({sid:'SM'+requests.length,status:'queued'}),{headers:{'Content-Type':'application/json'}});};
 try{
  await assert.rejects(()=>sendMessage(s,env,w,user,contact,'Hello'),/reply window is closed/);
  assert.equal(requests.length,0);
  await assert.rejects(()=>sendMessage(s,env,w,user,contact,'',null,{contentSid:'bad'}),/Content SID/);
  const contentSid='HX'+'a'.repeat(32);
  await assert.rejects(()=>sendMessage(s,env,w,user,contact,'',null,{contentSid,contentVariables:'[]'}),/numeric keys/);
  await sendMessage(s,env,w,user,contact,'',null,{contentSid,contentVariables:'{"1":"Taylor"}'});
  assert.equal(requests[0].get('ContentSid'),contentSid);assert.equal(requests[0].get('Body'),null);
  assert.equal(requests[0].get('ContentVariables'),'{"1":"Taylor"}');
  await s.insert(w,'messages',{contact:contact.id,direction:'inbound',channel:'WhatsApp',body:'Hi'},'recent-inbound').run();
  await sendMessage(s,env,w,user,contact,'Reply');assert.equal(requests[1].get('Body'),'Reply');
  await db.prepare('UPDATE records SET created=? WHERE id=?').bind(Date.now()-86400001,'recent-inbound').run();
  await assert.rejects(()=>sendMessage(s,env,w,user,contact,'Expired reply'),/reply window is closed/);
  await configure('+15550005555');await sendMessage(s,env,w,user,contact,'SMS hello');
  assert.equal(requests[2].get('To'),contact.phone);
  const messages=await s.list(w,'messages');assert.equal(messages.find(m=>m.body==='SMS hello').channel,'SMS');
  await assert.rejects(()=>sendMessage(s,env,w,user,{...contact,optOut:true},'',null,{contentSid}),/opted out/);
 }finally{globalThis.fetch=original;db.close();}
});

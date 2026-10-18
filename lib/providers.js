import {uid,now,fail,seal,open,hmac,equal,phone,required} from './security.js';
import {createLead} from './leads.js';
export async function credentials(s,env,w,p) {const r=await s.one('SELECT value FROM credentials WHERE workspace=? AND provider=?',w,p);if(!r)fail(`${p} is not connected. Ask an administrator to configure it in Integrations.`,422);return open(r.value,env.SECRET_KEY);}
export async function saveCredentials(s,env,w,p,data,actor) {
 const allowed={twilio:['sid','token','from'],stripe:['key','webhook'],google:['clientId','clientSecret'],resend:['key','from']};if(!allowed[p])fail('Unknown provider.');for(const k of allowed[p])required(data[k],k,2000);
 if(p==='stripe'&&!data.key.startsWith('sk_test_'))fail('Only Stripe test-mode keys are accepted.');
 const id=`${w}:${p}`;await s.batch([s.q('INSERT INTO credentials VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value,updated=excluded.updated',id,w,p,await seal(data,env.SECRET_KEY),now()),s.audit(w,actor,'integration.connected',p,{credentials:'[redacted]'})]);
}
export async function event(s,w,p,direction,ref,outcome,error='') {await s.run('INSERT INTO events VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(workspace,provider,reference,direction) DO UPDATE SET outcome=excluded.outcome,error=excluded.error,created=excluded.created',uid(),w,p,direction,ref,outcome,String(error).slice(0,400),now());}
export async function call(s,w,p,url,options,ref=uid()) {
 try {const r=await fetch(url,{...options,signal:AbortSignal.timeout(15000)});const data=r.status===204?{}:await r.json();if(!r.ok){const e=new Error(`${p} returned ${r.status}. ${data.error?.message||data.message||'Check the connection and try again.'}`);e.status=r.status===429||r.status>=500?503:422;throw e;}await event(s,w,p,'outbound',ref,'success');return data;}
 catch(e){await event(s,w,p,'outbound',ref,'failed',e.message);throw e;}
}
export async function sendMessage(s,env,w,user,contact,body,existing,template={}) {
 if(contact.optOut)fail('This contact opted out. Outbound messages are blocked.',422);
 const c=await credentials(s,env,w,'twilio'); const id=existing?.id||uid();
 const channel=c.from.startsWith('whatsapp:')?'WhatsApp':'SMS';
 const contentSid=existing?.contentSid||template.contentSid||'';
 let variables=existing?.contentVariables||template.contentVariables||{};
 if(contentSid){
  if(channel!=='WhatsApp')fail('Templates require a WhatsApp sender.',422);
  if(!/^HX[0-9a-fA-F]{32}$/.test(contentSid))fail('Enter a valid Twilio Content SID (HX followed by 32 hexadecimal characters).',422);
  if(typeof variables==='string'){try{variables=JSON.parse(variables||'{}');}catch{fail('Template variables must be a JSON object.',422);}}
  if(!variables||Array.isArray(variables)||typeof variables!=='object'||Object.entries(variables).some(([k,v])=>!/^\d+$/.test(k)||typeof v!=='string'||v.length>1600)||JSON.stringify(variables).length>10000)fail('Template variables must map numeric keys to text values.',422);
  body=`Template ${contentSid} ? ${JSON.stringify(variables)}`;
 }else{
  body=required(body,'Message',1600);
  if(channel==='WhatsApp'){
   const latest=(await s.list(w,'messages')).filter(m=>m.contact===contact.id&&m.direction==='inbound'&&m.channel==='WhatsApp').reduce((at,m)=>Math.max(at,m.created),0);
   if(!latest||now()-latest>=86400000)fail('The WhatsApp reply window is closed. Send an approved template to start a conversation.',422);
  }
 }

 if(!existing)await s.insert(w,'messages',{contact:contact.id,owner:user.id,body,direction:'outbound',status:'queued',channel,contentSid,contentVariables:contentSid?variables:undefined,requestedBy:user.name},id).run();
 try {const params=new URLSearchParams({To:c.from.startsWith('whatsapp:')?`whatsapp:${phone(contact.phone)}`:phone(contact.phone),From:c.from,...(contentSid?{ContentSid:contentSid,ContentVariables:JSON.stringify(variables)}:{Body:body}),StatusCallback:`${env.APP_URL}/api/webhooks/twilio/${w}?status=1`});
 const out=await call(s,w,'twilio',`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(c.sid)}/Messages.json`,{method:'POST',headers:{Authorization:`Basic ${btoa(c.sid+':'+c.token)}`,'Content-Type':'application/x-www-form-urlencoded'},body:params},id);
 const r=await s.get(w,'messages',id); await s.put(w,'messages',id,{...r,provider:out.sid,status:out.status||'sent',error:''},r.version,user.name,'message.sent');return out;
 }catch(e){const r=await s.get(w,'messages',id);await s.put(w,'messages',id,{...r,status:'failed',error:e.message},r.version,user.name,'message.failed');throw e;}
}
export async function paymentRequest(s,env,w,user,opp,contact,data) {
 const c=await credentials(s,env,w,'stripe');const amount=Number(data.amount),currency=String(data.currency||'USD').toUpperCase();if(!Number.isSafeInteger(amount)||amount<50||amount>999999999)fail('Amount must be between 50 and 999999999 minor units.');if(!['USD','GBP','EUR','PKR','AUD','CAD','AED'].includes(currency))fail('Choose a supported currency.');
 const id=uid(); await s.insert(w,'payments',{contact:contact.id,opportunity:opp.id,amount,currency,status:'creating',requestedBy:user.name,refunded:0},id).run();
 const form=new URLSearchParams({mode:'payment',success_url:env.APP_URL+'/?checkout=returned',cancel_url:env.APP_URL+'/?checkout=cancelled','line_items[0][price_data][currency]':currency.toLowerCase(),'line_items[0][price_data][unit_amount]':String(amount),'line_items[0][price_data][product_data][name]':opp.name,'line_items[0][quantity]':'1','metadata[requestId]':id,'payment_intent_data[metadata][requestId]':id});
 try{const out=await call(s,w,'stripe','https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:`Bearer ${c.key}`,'Idempotency-Key':id,'Content-Type':'application/x-www-form-urlencoded'},body:form},id);const r=await s.get(w,'payments',id);await s.put(w,'payments',id,{...r,provider:out.id,url:out.url,status:'pending',expires:out.expires_at*1000},r.version,user.name,'payment.requested');return s.get(w,'payments',id);}catch(e){const r=await s.get(w,'payments',id);await s.put(w,'payments',id,{...r,status:'failed',error:e.message},r.version,user.name,'payment.request_failed');throw e;}
}
export async function googleToken(s,env,w,user) {
 const cfg=await credentials(s,env,w,'google');const c=await credentials(s,env,w,`calendar:${user}`);
 if(c.expires>now()+60000)return c.access;
 try{const out=await call(s,w,'google','https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:cfg.clientId,client_secret:cfg.clientSecret,refresh_token:c.refresh,grant_type:'refresh_token'})});
 await s.run('UPDATE credentials SET value=?,updated=? WHERE workspace=? AND provider=?',await seal({...c,access:out.access_token,expires:now()+out.expires_in*1000},env.SECRET_KEY),now(),w,`calendar:${user}`);return out.access_token;
 }catch(e){await s.run('UPDATE credentials SET value=? WHERE workspace=? AND provider=?',await seal({...c,reconnect:true,expires:0},env.SECRET_KEY),w,`calendar:${user}`);fail('Google Calendar needs reconnection. Open Integrations and connect again.',422);}
}
export async function appointment(s,env,w,user,data,existing) {
 const owner=data.owner||user.id;const employee=await s.one('SELECT id FROM users WHERE workspace=? AND id=? AND active=1',w,owner);if(!employee)fail('Employee not found.',404);
 const access=await googleToken(s,env,w,owner),headers={Authorization:`Bearer ${access}`,'Content-Type':'application/json'}; const id=existing?.id||uid();
 if(data.cancel){if(!existing)fail('Appointment not found.',404);await call(s,w,'google',`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(existing.provider)}`,{method:'DELETE',headers});return s.put(w,'appointments',id,{...existing,status:'Cancelled'},existing.version,user.name,'appointment.cancelled');}
 const start=Number(data.start),end=Number(data.end);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||start<now()-60000)fail('Choose a future appointment with an end after its start.');
 const busy=await call(s,w,'google','https://www.googleapis.com/calendar/v3/freeBusy',{method:'POST',headers,body:JSON.stringify({timeMin:new Date(start).toISOString(),timeMax:new Date(end).toISOString(),items:[{id:'primary'}]})});
 const cal=busy.calendars?.primary;if(!cal||cal.errors?.length)fail('Google could not check calendar availability. Reconnect and try again.',422);
 if(cal.busy?.length&&!data.confirmConflict)fail('Google Calendar reports a scheduling conflict. Choose another time or explicitly confirm the conflict.',409);
 const payload={summary:required(data.name,'Title',160),start:{dateTime:new Date(start).toISOString()},end:{dateTime:new Date(end).toISOString()},description:'Booked through Relay'};
 const out=await call(s,w,'google',`https://www.googleapis.com/calendar/v3/calendars/primary/events${existing?'/'+encodeURIComponent(existing.provider):''}`,{method:existing?'PATCH':'POST',headers,body:JSON.stringify(payload)},id);
 const next={...data,owner,start,end,provider:out.id,url:out.htmlLink,status:'Scheduled'};if(existing)return s.put(w,'appointments',id,next,existing.version,user.name,'appointment.rescheduled');await s.batch([s.insert(w,'appointments',next,id),s.audit(w,user.name,'appointment.created',id,{contact:data.contact})]);return s.get(w,'appointments',id);
}
export async function processNotifications(s,env) {
 const jobs=await s.all("SELECT * FROM jobs WHERE kind='notify' AND ((state='pending' AND due<=?) OR (state='running' AND due<?)) ORDER BY due LIMIT 25",now(),now()-60000);
 for(const j of jobs){const claim=await s.run("UPDATE jobs SET state='running',due=? WHERE id=? AND ((state='pending' AND due<=?) OR (state='running' AND due<?))",now(),j.id,now(),now()-60000);if(!claim.meta.changes)continue;
 try{const d=JSON.parse(j.payload),u=await s.one('SELECT destination FROM users WHERE workspace=? AND id=?',j.workspace,d.user);if(!u?.destination)fail('New owner has no notification email configured.',422);const c=await credentials(s,env,j.workspace,'resend');
 await call(s,j.workspace,'resend','https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${c.key}`,'Content-Type':'application/json','Idempotency-Key':j.id},body:JSON.stringify({from:c.from,to:[u.destination],subject:`Lead needs attention: ${d.name}`,text:`${d.name}\nSource: ${d.source}\nReason: ${d.reason}\n${env.APP_URL}/?lead=${j.target}`})},`${j.id}:${j.attempts}`);await s.run("UPDATE jobs SET state='done' WHERE id=?",j.id);
 }catch(e){const tries=j.attempts+1;await s.run('UPDATE jobs SET state=?,attempts=?,due=? WHERE id=?',tries>=4||e.status===422?'failed':'pending',tries,now()+Math.min(300,15*2**tries)*1000,j.id);}
 }
}
export async function webhook(s,env,request,provider,w) {
 const cfg=await credentials(s,env,w,provider);const raw=await request.text();if(raw.length>1000000)fail('Payload too large.',413);let ref;
 if(provider==='twilio'){
 const form=new URLSearchParams(raw);let signed=env.APP_URL+new URL(request.url).pathname+new URL(request.url).search;for(const k of [...new Set(form.keys())].sort())for(const v of form.getAll(k).sort())signed+=k+v;
 if(!equal(await hmac(cfg.token,signed,'SHA-1','base64'),request.headers.get('x-twilio-signature'))){await event(s,w,provider,'inbound',uid(),'rejected','Invalid signature');fail('Invalid signature.',403);}
 ref=form.get('MessageSid');if(!ref)fail('Missing message reference.');const status=new URL(request.url).searchParams.has('status');const eventRef=status?ref+':'+form.get('MessageStatus'):ref;
 if(await s.one("SELECT id FROM events WHERE workspace=? AND provider=? AND reference=? AND direction='inbound' AND outcome='success'",w,provider,eventRef))return {duplicate:true};
 if(status){const message=(await s.list(w,'messages')).find(x=>x.provider===ref);if(message){const rank={queued:0,sending:1,sent:2,delivered:3,read:4,failed:5,undelivered:5};if((rank[form.get('MessageStatus')]??0)>=(rank[message.status]??0))await s.put(w,'messages',message.id,{...message,status:form.get('MessageStatus'),error:form.get('ErrorCode')?`Twilio error ${form.get('ErrorCode')}`:''},message.version,'Twilio','message.delivery');}}
 else {const channel=String(form.get('From')).startsWith('whatsapp:')?'WhatsApp':'SMS';const sender=phone(form.get('From'));let contact=(await s.list(w,'contacts')).find(c=>c.phone===sender);const messageId=`twilio:${w}:${ref}`;if(!(await s.get(w,'messages',messageId))){
 if(!contact){const id=uid();contact={id,name:form.get('ProfileName')||sender,phone:sender,email:'',tags:[channel],optOut:false};const cstmt=s.insert(w,'contacts',contact,id);await createLead(s,w,{name:contact.name,contact:id,source:'Twilio '+channel},'Twilio',[cstmt,s.insert(w,'messages',{contact:id,body:form.get('Body')||'',provider:ref,direction:'inbound',status:'received',channel},messageId)]);}
 else await s.insert(w,'messages',{contact:contact.id,body:form.get('Body')||'',provider:ref,direction:'inbound',status:'received',channel},messageId).run();
 const body=(form.get('Body')||'').trim().toUpperCase();if(['STOP','UNSUBSCRIBE','CANCEL'].includes(body)){const latest=await s.get(w,'contacts',contact.id);await s.put(w,'contacts',contact.id,{...latest,optOut:true},latest.version,'Twilio','contact.opted_out');}
 }}await event(s,w,provider,'inbound',eventRef,'success');return {ok:true};
 }
 if(provider==='stripe'){
 const sig=request.headers.get('stripe-signature')||'',parts=sig.split(',').map(p=>p.trim()),ts=parts.find(p=>p.startsWith('t='))?.slice(2);
 const expected=ts?await hmac(cfg.webhook,`${ts}.${raw}`):'';if(!ts||!Number.isFinite(Number(ts))||Math.abs(now()/1000-Number(ts))>300||!parts.some(p=>p.startsWith('v1=')&&equal(p.slice(3),expected))){await event(s,w,provider,'inbound',uid(),'rejected','Invalid signature');fail('Invalid signature.',403);}
 const e=JSON.parse(raw);if(e.livemode)fail('Live-mode events are not supported.',422);ref=e.id;const o=e.data?.object;if(!ref||!o)fail('Invalid event.');
 if(await s.one("SELECT id FROM events WHERE workspace=? AND provider='stripe' AND reference=? AND direction='inbound' AND outcome='success'",w,ref))return {duplicate:true};
 const rows=await s.list(w,'payments');const p=rows.find(p=>p.id===o.metadata?.requestId||p.provider===o.id||p.intent===o.payment_intent);
 if(p){let next={...p};const ledger=[];if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(e.type)){next.intent=o.payment_intent;if(o.payment_status==='paid'){next.status=p.refunded>=p.amount?'refunded':'paid';next.paidAt=p.paidAt||(e.created?e.created*1000:now());ledger.push([`collected:${w}:${p.id}`,JSON.stringify({contact:p.contact,payment:p.id,amount:p.amount,currency:p.currency,type:'payment',confirmed:next.paidAt}),next.paidAt]);}else if(!['paid','refunded'].includes(p.status))next.status='processing';}
 if(e.type==='checkout.session.expired'&&!['paid','refunded'].includes(p.status))next.status='expired';
 if(e.type==='checkout.session.async_payment_failed'&&p.status!=='paid')next.status='failed';
 if(e.type==='charge.refunded'){next.refunded=Math.max(p.refunded||0,o.amount_refunded||0);next.status=next.refunded>=p.amount?'refunded':'paid';const refundId=`refund-total:${w}:${p.id}:${next.refunded}`;if(next.refunded>(p.refunded||0)){const confirmed=e.created?e.created*1000:now();ledger.push([refundId,JSON.stringify({contact:p.contact,payment:p.id,amount:-(next.refunded-(p.refunded||0)),currency:p.currency,type:'refund',confirmed}),confirmed]);}}
 // A failed optimistic update is retried by Stripe; successful ledger IDs deduplicate repeated events.
 next._stripeEvent=e.id;
 const guard="SELECT 1 FROM records WHERE workspace=? AND id=? AND version=? AND json_extract(data,'$._stripeEvent')=?";
 const args=[w,p.id,p.version+1,e.id];
 const result=await s.batch([s.update(w,'payments',p.id,next,p.version),...ledger.map(([id,data,at])=>s.q(`INSERT OR IGNORE INTO records SELECT ?,?,'collections',?,1,?,? WHERE EXISTS(${guard})`,id,w,data,at,now(),...args)),s.q(`INSERT INTO audit SELECT ?,?,'Stripe','payment.updated',?,?,? WHERE EXISTS(${guard})`,uid(),w,p.id,JSON.stringify({before:p,after:next}),now(),...args)]);
 if(!result[0].meta.changes)fail('Payment changed concurrently. Retry this event.',409);}
 await event(s,w,provider,'inbound',ref,'success');return {ok:true};
 }fail('Unknown webhook.',404);
}


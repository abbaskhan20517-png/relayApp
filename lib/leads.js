import {uid,now,fail,defaults} from './security.js';
export async function settings(s,w) { const ws=await s.one('SELECT * FROM workspaces WHERE id=?',w); return {...defaults,...JSON.parse(ws.settings)}; }
export async function eligible(s,w,exclude=[]) {
 const users=await s.all("SELECT id,name FROM users WHERE workspace=? AND status='Available' AND active=1 ORDER BY id",w);
 const leads=await s.list(w,'leads');
 const full=await s.all('SELECT id,capacity FROM users WHERE workspace=?',w);
 return users.filter(u=>!exclude.includes(u.id)&&leads.filter(l=>l.owner===u.id&&l.status!=='Closed').length<(full.find(x=>x.id===u.id)?.capacity||10));
}
export function recoveryReasons(l,c,t=now()) { if(l.status==='Closed')return [];const r=[]; if(!l.acknowledged&&l.deadline&&l.deadline<t)r.push('Acknowledgement overdue');if((l.escalations||0)>=2)r.push('Escalated twice');if(t-(l.lastActivity||l.created)>c.idle*1000)r.push('No recent activity');if(l.fallback)r.push('No eligible employee');if(l.exhausted&&!l.acknowledged)r.push('Final escalation reached');return r; }
export function job(s,w,id,version,due) {return s.q("INSERT OR IGNORE INTO jobs VALUES(?,?,?,?,?,?,'pending',0,'{}')",`ack:${id}:${version}`,w,'escalate',id,version,due);}
export async function createLead(s,w,data,actor='System',stmts=[]) {
 const c=await settings(s,w);const id=uid(),t=now();const lead={...data,status:'Open',source:data.source||'Manual',assigned:t,firstAssigned:t,deadline:t+c.window*1000,acknowledged:null,lastActivity:t,escalations:0,visited:[],fallback:false};
 // Eligibility and least-recent assignment selection execute inside the INSERT transaction.
 // Concurrent intake cannot overfill an employee based on a stale application-side count.
 const ownerSql=`SELECT u.id FROM users u WHERE u.workspace=? AND u.active=1 AND u.status='Available' AND (SELECT COUNT(*) FROM records r WHERE r.workspace=u.workspace AND r.kind='leads' AND json_extract(r.data,'$.owner')=u.id AND json_extract(r.data,'$.status')!='Closed')<u.capacity ORDER BY COALESCE((SELECT MAX(json_extract(r.data,'$.assigned')) FROM records r WHERE r.workspace=u.workspace AND r.kind='leads' AND json_extract(r.data,'$.owner')=u.id),0),u.id LIMIT 1`;
 const fallbackSql="SELECT id FROM users WHERE workspace=? AND role='Owner' AND active=1 LIMIT 1";
 const insert=s.q(`INSERT INTO records SELECT ?,?,'leads',json_set(?,'$.owner',COALESCE((${ownerSql}),(${fallbackSql})),'$.fallback',CASE WHEN (${ownerSql}) IS NULL THEN json('true') ELSE json('false') END,'$.visited',json_array(COALESCE((${ownerSql}),(${fallbackSql})))),1,?,?`,id,w,JSON.stringify(lead),w,w,w,w,w,t,t);
 const notification=s.q("INSERT INTO records SELECT ?,?,'notifications',json_object('user',json_extract(data,'$.owner'),'title',?,'target',?,'read',json('false')),1,?,? FROM records WHERE id=? AND workspace=?",uid(),w,`New lead: ${lead.name}`,id,t,t,id,w);
 const history=s.q("INSERT INTO audit SELECT ?,?,?, 'lead.assigned',?,json_object('owner',json_extract(data,'$.owner'),'source',json_extract(data,'$.source'),'fallback',json_extract(data,'$.fallback')),? FROM records WHERE id=? AND workspace=?",uid(),w,actor,id,t,id,w);
 await s.batch([...stmts,insert,job(s,w,id,1,lead.deadline),notification,history]);
 return s.get(w,'leads',id);
}
export async function acknowledge(s,w,id,actor,actorName,privileged=false) {
 const l=await s.get(w,'leads',id);if(!l)fail('Lead not found.',404);if(l.owner!==actor&&!privileged)fail('Only the current assignee can acknowledge this lead.',403);if(l.acknowledged)return l;
 const t=now();const updated=await s.put(w,'leads',id,{...l,acknowledged:t,firstAcknowledged:l.firstAcknowledged||t,lastActivity:t,fallback:false,exhausted:false},l.version,actorName,'lead.acknowledged');
 await s.run("UPDATE jobs SET state='cancelled' WHERE workspace=? AND target=? AND kind='escalate' AND state='pending'",w,id);return updated;
}
export async function reassign(s,w,id,owner,actor,reason='Manual reassignment',automatic=false,expected) {
 const l=await s.get(w,'leads',id); if(!l)fail('Lead not found.',404); if(expected!==undefined&&(l.version!==expected||l.acknowledged||l.status==='Closed'))return null;
 const u=await s.one('SELECT * FROM users WHERE workspace=? AND id=? AND active=1',w,owner);if(!u)fail('Choose an active workspace employee.');
 const c=await settings(s,w),t=now();const level=(l.escalations||0)+(automatic?1:0);const deadline=t+(c.levels[Math.min(level,c.levels.length-1)]||c.window)*1000;
 const final=c.final||(await s.one("SELECT id FROM users WHERE workspace=? AND role='Owner' AND active=1",w))?.id;
 const responsibleFallback=automatic&&owner===final;const isEligible=(await eligible(s,w,[])).some(x=>x.id===owner);
 const next={...l,owner,assigned:t,deadline,acknowledged:null,lastActivity:t,escalations:level,visited:[...new Set([...(l.visited||[]),owner])],fallback:responsibleFallback&&!isEligible,exhausted:automatic&&level>=c.levels.length};
 // The UPDATE and all dependent writes share a D1/SQLite transaction. Each dependent insert is guarded by the newly written version and owner.
 const newVersion=l.version+1,token=uid();next.transition=token;
 const guard='SELECT 1 FROM records WHERE id=? AND workspace=? AND version=? AND json_extract(data,\'$.transition\')=?';const args=[id,w,newVersion,token];
 const auditId=uid();
 const capacityGuard=automatic&&!responsibleFallback?" AND EXISTS(SELECT 1 FROM users u WHERE u.id=? AND u.workspace=? AND u.active=1 AND u.status='Available' AND (SELECT COUNT(*) FROM records r WHERE r.workspace=u.workspace AND r.kind='leads' AND json_extract(r.data,'$.owner')=u.id AND json_extract(r.data,'$.status')!='Closed' AND r.id!=?)<u.capacity)":'';
 const change=s.q('UPDATE records SET data=?,version=version+1,updated=? WHERE workspace=? AND kind=\'leads\' AND id=? AND version=?'+capacityGuard,JSON.stringify(next),t,w,id,l.version,...(capacityGuard?[owner,w,id]:[]));
 const stmts=[change,s.q(`INSERT INTO audit SELECT ?,?,?,?,?,?,? WHERE EXISTS(${guard})`,auditId,w,actor,automatic?'lead.escalated':'lead.reassigned',id,JSON.stringify({reason,previous:l.owner,owner}),t,...args),s.q(`INSERT INTO records SELECT ?,?,'notifications',?,1,?,? WHERE EXISTS(${guard})`,uid(),w,JSON.stringify({user:owner,title:`${reason}: ${l.name}`,target:id,read:false}),t,t,...args)];
 if(!next.exhausted)stmts.push(s.q(`INSERT OR IGNORE INTO jobs SELECT ?,?,'escalate',?,?,?,'pending',0,'{}' WHERE EXISTS(${guard})`,`ack:${id}:${newVersion}`,w,id,newVersion,deadline,...args));
 if(automatic)stmts.push(s.q(`INSERT OR IGNORE INTO jobs SELECT ?,?,'notify',?,? ,?,'pending',0,? WHERE EXISTS(${guard})`,`notify:${token}`,w,id,newVersion,t,JSON.stringify({user:owner,name:l.name,source:l.source,reason}),...args));
 const results=await s.batch(stmts);return results[0].meta.changes?s.get(w,'leads',id):null;
}
export async function processEscalations(s,onlyWorkspace) {
 const jobs=await s.all("SELECT * FROM jobs WHERE kind='escalate' AND state='pending' AND due<=? "+(onlyWorkspace?'AND workspace=? ':'')+'ORDER BY due LIMIT 100',now(),...(onlyWorkspace?[onlyWorkspace]:[]));
 for(const j of jobs){const l=await s.get(j.workspace,'leads',j.target);if(!l||l.version!==j.version||l.acknowledged||l.status==='Closed'){await s.run("UPDATE jobs SET state='cancelled' WHERE id=?",j.id);continue;}
 const c=await settings(s,j.workspace);const options=await eligible(s,j.workspace,l.visited||[]);const final=c.final||(await s.one("SELECT id FROM users WHERE workspace=? AND role='Owner' AND active=1",j.workspace))?.id;
 const nextLevel=(l.escalations||0)+1;const owner=nextLevel>=c.levels.length?final:options[0]?.id||(c.backup&&!(l.visited||[]).includes(c.backup)?c.backup:final);
 let moved=owner?await reassign(s,j.workspace,l.id,owner,'System','Acknowledgement window expired',true,j.version):null;
 if(!moved){const latest=await s.get(j.workspace,'leads',l.id);if(latest?.version===j.version&&!latest.acknowledged){const retry=await eligible(s,j.workspace,latest.visited||[]);const retryOwner=retry[0]?.id||final;if(retryOwner)moved=await reassign(s,j.workspace,l.id,retryOwner,'System','Acknowledgement window expired',true,j.version);if(!moved)continue;}}
 await s.run("UPDATE jobs SET state='done' WHERE id=?",j.id);
 }
 return jobs.length;
}

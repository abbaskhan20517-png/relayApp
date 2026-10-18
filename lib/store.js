import { uid,now,fail } from './security.js';
export function store(db) {
 const q=(sql,...args)=>db.prepare(sql).bind(...args);
 const all=async(sql,...args)=>(await q(sql,...args).all()).results;
 const one=(sql,...args)=>q(sql,...args).first();
 const run=(sql,...args)=>q(sql,...args).run();
 const batch=stmts=>db.batch(stmts);
 const row=r=>r?{...JSON.parse(r.data),id:r.id,version:r.version,created:r.created,updated:r.updated}:null;
 const get=async(w,kind,id)=>row(await one('SELECT * FROM records WHERE workspace=? AND kind=? AND id=?',w,kind,id));
 const list=async(w,kind)=> (await all('SELECT * FROM records WHERE workspace=? AND kind=? ORDER BY created DESC LIMIT 5000',w,kind)).map(row);
 const insert=(w,kind,data,id=uid())=>q('INSERT INTO records(id,workspace,kind,data,version,created,updated) VALUES(?,?,?,?,1,?,?)',id,w,kind,JSON.stringify(data),now(),now());
 const audit=(w,actor,type,target,detail={})=>q('INSERT INTO audit VALUES(?,?,?,?,?,?,?)',uid(),w,actor,type,target,JSON.stringify(detail),now());
 const update=(w,kind,id,data,version)=>q('UPDATE records SET data=?,version=version+1,updated=? WHERE workspace=? AND kind=? AND id=? AND version=?',JSON.stringify(data),now(),w,kind,id,version);
 async function put(w,kind,id,data,version,actor='System',type='record.edited') {
  const before=await get(w,kind,id);if(!before||before.version!==version)fail('This record changed. Reload it and try again.',409);
  const token=uid(),next={...data,_edit:token};
  const results=await batch([update(w,kind,id,next,version),q("INSERT INTO audit SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM records WHERE workspace=? AND id=? AND version=? AND json_extract(data,'$._edit')=?)",uid(),w,actor,type,id,JSON.stringify({before,after:data}),now(),w,id,version+1,token)]);
  if(!results[0].meta.changes) fail('This record changed. Reload it and try again.',409);return get(w,kind,id);
 }
 return {q,all,one,run,batch,row,get,list,insert,audit,update,put};
}

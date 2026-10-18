import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
export function database(filename=':memory:'){
 const db=new DatabaseSync(filename);db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
 db.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY)');
 for(const name of readdirSync(new URL('../drizzle/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())if(!db.prepare('SELECT name FROM _migrations WHERE name=?').get(name)){db.exec('BEGIN');try{db.exec(readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));db.prepare('INSERT INTO _migrations VALUES(?)').run(name);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}
 const wrap=(sql,bindings=[])=>({sql,bindings,bind(...args){return wrap(sql,args);},async first(){return db.prepare(sql).get(...bindings)||null;},async all(){return {results:db.prepare(sql).all(...bindings)};},async run(){const r=db.prepare(sql).run(...bindings);return {meta:{changes:Number(r.changes)}};}});
 return {prepare:sql=>wrap(sql),async batch(statements){db.exec('BEGIN IMMEDIATE');try{const out=[];for(const q of statements){const r=db.prepare(q.sql).run(...q.bindings);out.push({meta:{changes:Number(r.changes)}});}db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}},close:()=>db.close(),raw:db};
}


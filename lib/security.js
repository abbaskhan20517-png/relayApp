const enc = new TextEncoder();
export const uid = () => crypto.randomUUID();
export const now = () => Date.now();
export function fail(message, status=400) { throw Object.assign(new Error(message), {status}); }
export function required(v, name, max=500) { if(typeof v !== 'string' || !v.trim() || v.length>max) fail(`${name} is required (maximum ${max} characters).`); return v.trim(); }
export function email(v) { v=required(v,'Email',254).toLowerCase(); if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) fail('Enter a valid email address.'); return v; }
export function phone(v) { const p=String(v||'').replace(/^whatsapp:/,'').replace(/[^\d+]/g,''); if(!/^\+[1-9]\d{7,14}$/.test(p)) fail('Use an international phone number, for example +923001234567.'); return p; }
export const b64 = a => btoa(String.fromCharCode(...new Uint8Array(a)));
export const unb64 = s => Uint8Array.from(atob(s), c=>c.charCodeAt(0));
export async function hash(v) { return b64(await crypto.subtle.digest('SHA-256', enc.encode(v))); }
export function equal(a,b) { if(typeof a!=='string'||typeof b!=='string') return false; let diff=a.length^b.length; for(let i=0;i<Math.max(a.length,b.length);i++) diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0); return diff===0; }
export async function password(v, existing) {
  required(v,'Password',128); if(v.length<10) fail('Use a password with at least 10 characters.');
  const salt=existing?.split(':')[1] || b64(crypto.getRandomValues(new Uint8Array(16)));
  const key=await crypto.subtle.importKey('raw',enc.encode(v),'PBKDF2',false,['deriveBits']);
  return `pbkdf2-sha256:${salt}:${b64(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:unb64(salt),iterations:100000},key,256))}`;
}
export async function hmac(secret,value,algorithm='SHA-256',format='hex') {
 const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:algorithm},false,['sign']);
 const out=await crypto.subtle.sign('HMAC',key,enc.encode(value)); return format==='base64'?b64(out):[...new Uint8Array(out)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function seal(value,master) {
 if(!master) fail('Configure SECRET_KEY on the server before connecting integrations.',503);
 const key=await crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',enc.encode(master)),'AES-GCM',false,['encrypt']); const iv=crypto.getRandomValues(new Uint8Array(12));
 return `${b64(iv)}.${b64(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(value))))}`;
}
export async function open(value,master) {
 if(!master) fail('Integration encryption key is unavailable.',503); const [iv,data]=value.split('.');
 const key=await crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',enc.encode(master)),'AES-GCM',false,['decrypt']);
 return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv)},key,unb64(data))));
}
export const permissions=['view','create','edit','delete','export','values','assignment','integrations','audit','configuration','team'];
export const defaults={window:300,idle:86400,levels:[300,300,600],backup:'',final:'',timezone:'Asia/Karachi'};
export const baseRoles=[{name:'Owner',base:'Owner',permissions},{name:'Admin',base:'Admin',permissions:permissions.filter(p=>p!=='team')},{name:'User',base:'User',permissions:['view','create','edit']},{name:'Manager',base:'User',permissions:['view','create','edit','values','assignment','audit']}];

import {existsSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';

process.chdir(fileURLToPath(new URL('../',import.meta.url)));
if(Number(process.versions.node.split('.')[0])<24)throw new Error('Relay local mode requires Node.js 24 or newer.');
mkdirSync('.local',{recursive:true});
if(!existsSync('.env')){
 const secret=()=>randomBytes(48).toString('base64url');
 writeFileSync('.env',`APP_URL=http://127.0.0.1:5173\nPORT=5173\nSECRET_KEY=${secret()}\nWORKER_TOKEN=${secret()}\n`,{flag:'wx',mode:0o600});
 console.log('Created local .env with secure random keys. Existing data and keys are preserved on later runs.');
}else console.log('Existing .env preserved.');
console.log('Run npm run local, then open http://127.0.0.1:5173.');

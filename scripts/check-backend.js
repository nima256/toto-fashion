const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.join(__dirname,'..');
const dirs=['config','models','routes','services','middlewares','utils','scripts'];let files=['server.js'];for(const d of dirs){for(const f of fs.readdirSync(path.join(root,d)))if(f.endsWith('.js'))files.push(path.join(d,f));}
let failed=false;for(const f of files){const r=cp.spawnSync(process.execPath,['--check',path.join(root,f)],{encoding:'utf8'});if(r.status!==0){failed=true;console.error(`FAIL ${f}\n${r.stderr}`);}else console.log(`OK   ${f}`);}if(failed)process.exit(1);

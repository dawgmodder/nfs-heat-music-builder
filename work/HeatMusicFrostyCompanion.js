'use strict';
// Official Frosty remains untouched. Compose into a NEW profile; never patch links in place.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const {inspectEa}=require('./HeatMusicEaLayer3');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function hash(file){const h=crypto.createHash('sha256'),b=Buffer.alloc(1024*1024),fd=fs.openSync(file,'r');try{let n;while((n=fs.readSync(fd,b,0,b.length,null)))h.update(b.subarray(0,n));}finally{fs.closeSync(fd);}return h.digest('hex');}
function inside(root,file){const r=path.relative(path.resolve(root),path.resolve(file));return r!==''&&!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r);}
function safeFile(root,relative){if(typeof relative!=='string'||path.isAbsolute(relative))throw Error('Unsafe bundle path');const f=path.resolve(root,relative);if(!inside(root,f)||!inside(fs.realpathSync(root),fs.realpathSync(f)))throw Error('Bundle path escapes its folder');return f;}
function tocIndex(bytes){
 if(bytes.length<604)throw Error('Truncated Heat TOC');
 const g=bytes.readUInt32BE(572)+556,n=bytes.readUInt32BE(576),loc=bytes.readUInt32BE(580)+556;
 if(n>1000000||g+n*20>bytes.length||loc>bytes.length)throw Error('Invalid Heat TOC tables');
 const keys=new Map(),offsets=new Map();
 for(let i=0;i<n;i++){const p=g+i*20,key=bytes.subarray(p,p+16).toString('hex'),at=loc+(bytes.readUInt32BE(p+16)&0xffffff)*4;
  if(at+12>bytes.length||keys.has(key)||offsets.has(at))throw Error('Invalid/duplicate Heat TOC chunk');keys.set(key,at);offsets.set(at,key);}
 return{bytes,keys,offsets};
}
function readToc(root,layer){return tocIndex(fs.readFileSync(path.join(root,layer,'Win32/chunks0.toc')));}
function wrap(raw){const blocks=[];for(let p=0;p<raw.length;p+=65536){const n=Math.min(65536,raw.length-p),b=Buffer.alloc(n+8);b.writeUInt32BE(n);b.writeUInt16BE(n===65536?0x71:0x70,4);b.writeUInt16BE(n===65536?0:n,6);raw.copy(b,8,p,p+n);blocks.push(b);}return Buffer.concat(blocks);}
function unwrap(b){const parts=[];for(let p=0;p<b.length;){if(p+8>b.length)throw Error('Truncated CAS header');const n=b.readUInt32BE(p),codec=b.readUInt16BE(p+4),size=b.readUInt16BE(p+6)||65536;if(![0x70,0x71].includes(codec)||n!==size||p+8+n>b.length)throw Error('Invalid companion CAS block');parts.push(b.subarray(p+8,p+8+n));p+=8+n;}return Buffer.concat(parts);}
function noGame(){if(process.platform!=='win32')return;const r=cp.spawnSync('tasklist.exe',['/FO','CSV','/NH'],{encoding:'utf8',windowsHide:true});if(r.status!==0)throw Error('Could not check running game processes');if(/^"NeedForSpeedHeat\.exe"/im.test(r.stdout))throw Error('Close NFS Heat before finalizing. No processes will be terminated.');}
function exportCompanion({game,build,modFile,output}){
 const m=JSON.parse(fs.readFileSync(path.join(build,'manifest.json'))),rows=fs.readFileSync(path.join(build,'waves.tsv'),'utf8').trim().split(/\r?\n/).map(x=>x.split('\t'));
 const items=m.placements.map(x=>({...x,layer:'Data'})).concat([m.patchAudio,...m.patchExtras].map(x=>({...x,layer:'Patch'})));
 if(items.length!==199||rows.length!==199)throw Error('Expected all 199 audio entries');
 const rowMap=new Map(rows.map(r=>[r[0],r]));if(rowMap.size!==199)throw Error('Duplicate wave names');
 const originals={Data:readToc(game,'Data'),Patch:readToc(game,'Patch')};
 const id='NFSHeatCustomSoundtrack_'+m.id,bundle=path.join(output,id+'.music');
 if(fs.existsSync(bundle))throw Error('Companion export already exists: '+bundle);
 const prepared=[];
 for(const item of items){const r=rowMap.get(item.name),key=originals[item.layer].offsets.get(item.tocOffset);if(!r||r.length!==4||!key)throw Error('Missing original audio identity: '+item.name);
  if(item.oldLocation&&originals[item.layer].bytes.subarray(item.tocOffset,item.tocOffset+12).toString('hex')!==item.oldLocation)throw Error('Game version differs from prepared audio: '+item.name);
  const audio=safeFile(build,r[3]),info=inspectEa(audio,Number(r[2]),0.05,{repair:false});
  if(info.sha256!==item.audioSha256||info.bytes!==item.audioBytes)throw Error('Audio integrity mismatch: '+item.name);
  prepared.push({name:item.name,key,layer:item.layer,sha256:info.sha256,bytes:info.bytes,seconds:info.seconds,audio:'audio/'+info.sha256+'.ealayer3',source:audio});
 }
 fs.mkdirSync(path.join(bundle,'audio'),{recursive:true});
 for(const e of prepared){const dest=path.join(bundle,e.audio);if(!fs.existsSync(dest))fs.copyFileSync(e.source,dest,fs.constants.COPYFILE_EXCL);delete e.source;}
 const data={schema:1,version:'4.3',id:m.id,modFile:path.basename(modFile),modSha256:hash(modFile),originalToc:{Data:sha(originals.Data.bytes),Patch:sha(originals.Patch.bytes)},entries:prepared};
 fs.writeFileSync(path.join(bundle,'soundtrack.heatmusic'),JSON.stringify(data,null,2),{flag:'wx'});return path.join(bundle,'soundtrack.heatmusic');
}
function loadBundle(file,game){
 const root=path.dirname(path.resolve(file)),m=JSON.parse(fs.readFileSync(file,'utf8'));
 if(m.schema!==1||!/^HeatMusic_\d{14}_[0-9a-f]{6}$/.test(m.id)||!Array.isArray(m.entries)||m.entries.length!==199||path.basename(m.modFile)!==m.modFile)throw Error('Invalid companion manifest');
 for(const l of ['Data','Patch'])if(hash(path.join(game,l,'Win32/chunks0.toc'))!==m.originalToc[l])throw Error('Game TOC differs from the version used to build this soundtrack. Rebuild first.');
 const seen=new Set();for(const e of m.entries){if(!/^[a-f0-9]{32}$/.test(e.key)||!['Data','Patch'].includes(e.layer)||seen.has(e.key)||!Number.isSafeInteger(e.bytes)||e.bytes<24)throw Error('Invalid/duplicate audio entry');seen.add(e.key);
  const info=inspectEa(safeFile(root,e.audio),e.seconds,0.001,{repair:false});if(info.bytes!==e.bytes||info.sha256!==e.sha256)throw Error('Audio checksum mismatch: '+e.name);}
 return{root,m};
}
function sourceStamp(root){const records=[];const seen=new Set();function scan(dir,rel=''){const real=fs.realpathSync(dir);if(seen.has(real))throw Error('Cyclic profile directory');seen.add(real);
 for(const n of fs.readdirSync(dir).sort()){const f=path.join(dir,n),r=path.join(rel,n),s=fs.lstatSync(f);if(s.isSymbolicLink()){records.push([r,'link',fs.readlinkSync(f)]);continue;}if(s.isDirectory())scan(f,r);else records.push([r,s.size,s.mtimeMs,s.ctimeMs]);}seen.delete(real);}scan(root);return sha(Buffer.from(JSON.stringify(records)));}
function compose({game,profile,bundle,outputRoot,check=noGame,log=console.log,cancel=()=>{},archiveLimit=0x40000000}){
 game=fs.realpathSync(game);profile=fs.realpathSync(profile);const modData=path.join(game,'ModData');
 if(path.dirname(profile).toLowerCase()!==modData.toLowerCase()||/^HeatMusicCombined_|\.partial$/i.test(path.basename(profile)))throw Error('Select an original Frosty profile directly inside the game ModData folder');
 if(!fs.existsSync(path.join(game,'NeedForSpeedHeat.exe')))throw Error('Game executable missing');
 check();cancel();const {root,m}=loadBundle(bundle,game);
 const modsPath=path.join(profile,'Patch/mods.json'),mods=JSON.parse(fs.readFileSync(modsPath,'utf8'));
 if(!Array.isArray(mods)||mods.length===0||mods[mods.length-1].file_name!==m.modFile||mods.filter(x=>/^NFSHeatCustomSoundtrack_/i.test(x.file_name||'')).length!==1)throw Error('Apply the matching soundtrack LAST in Frosty, generate the profile, then close the game.');
 const startStamp=sourceStamp(profile),tables={Data:readToc(profile,'Data'),Patch:readToc(profile,'Patch')};
 for(const e of m.entries){const t=tables.Patch.keys.has(e.key)?tables.Patch:tables.Data;if(!t.keys.has(e.key))throw Error('Frosty profile lacks an expected chunk: '+e.name);}
 outputRoot=path.resolve(outputRoot||modData);fs.mkdirSync(outputRoot,{recursive:true});
 const token=crypto.randomBytes(4).toString('hex'),id='HeatMusicCombined_'+Date.now()+'_'+token,stage=path.join(outputRoot,id+'.partial'),target=path.join(outputRoot,id);
 const mandatory=new Set(['data','data/win32','data/win32/configurations','data/win32/configurations/superbundleinstallpackage','data/win32/configurations/superbundleinstallpackage2','patch','patch/win32','patch/win32/configurations','patch/win32/configurations/superbundleinstallpackage','patch/win32/configurations/superbundleinstallpackage2']);
 const originalRoots=['Data','Patch','Update'].map(l=>path.join(game,l));const ownedCopies=[],activeDirectories=new Set();
 function original(f){return originalRoots.some(r=>f.toLowerCase()===r.toLowerCase()||inside(r.toLowerCase(),f.toLowerCase()));}
 function clone(src,dst,rel=''){
  cancel();let real;try{real=fs.realpathSync(src);}catch(e){if(rel.toLowerCase()==='update'&&e.code==='ENOENT'){log('SKIP_OPTIONAL_BROKEN_UPDATE_LINK');return;}throw e;}
  if(!original(real)&&real!==profile&&!inside(profile,real))throw Error('Profile link points outside the game and selected profile: '+src);
  if(fs.statSync(src).isDirectory()){
   if(original(real)&&!mandatory.has(rel.toLowerCase())){fs.symlinkSync(real,dst,'junction');return;}
   if(activeDirectories.has(real.toLowerCase()))throw Error('Cyclic profile directory link');activeDirectories.add(real.toLowerCase());
   try{fs.mkdirSync(dst);for(const n of fs.readdirSync(src))clone(path.join(src,n),path.join(dst,n),rel?rel+'/'+n:n);}finally{activeDirectories.delete(real.toLowerCase());}
  }else{
   if(original(real)&&!rel.toLowerCase().endsWith('/chunks0.toc')){
    try{fs.symlinkSync(real,dst,'file');}catch(error){if(!['EPERM','EACCES','ENOTSUP'].includes(error.code))throw error;try{fs.linkSync(real,dst);}catch(linkError){if(fs.statSync(real).size>32*1024*1024)throw Error('Could not link original game archives. Run Music Builder as administrator on a local NTFS drive. '+linkError.message);fs.copyFileSync(real,dst,fs.constants.COPYFILE_EXCL);}}
   }
   else {fs.copyFileSync(src,dst,fs.constants.COPYFILE_EXCL);if(hash(src)!==hash(dst))throw Error('Profile changed during copy: '+rel);ownedCopies.push({rel,sha256:hash(dst)});}
  }
 }
 log('COMPOSING_PROFILE',profile);clone(profile,stage);
 const writers=new Map(),archives=[],tocChanges=new Map();
 function nextArchive(group,layer,catalog){const dir=path.join(stage,layer,'Win32/configurations',catalog?'superbundleinstallpackage2':'superbundleinstallpackage');fs.mkdirSync(dir,{recursive:true});let index=1;while(index<=255&&fs.existsSync(path.join(dir,'cas_'+String(index).padStart(2,'0')+'.cas')))index++;if(index>255)throw Error('No free 8-bit CAS index');const file=path.join(dir,'cas_'+String(index).padStart(2,'0')+'.cas'),previous=writers.get(group),w={group,index,file,fd:fs.openSync(file,'wx'),size:0,cache:previous?previous.cache:new Map()};writers.set(group,w);archives.push(w);return w;}
 try{
  for(const e of m.entries){cancel();const layer=tables.Patch.keys.has(e.key)?'Patch':'Data',table=tables[layer],at=table.keys.get(e.key),catalog=table.bytes[at+2];
   if(catalog>1)throw Error('Unsupported Heat audio catalog');const group=layer+'/'+catalog;
   let w=writers.get(group)||nextArchive(group,layer,catalog),placement=w.cache.get(e.sha256);
   if(!placement){const raw=fs.readFileSync(safeFile(root,e.audio));if(sha(raw)!==e.sha256)throw Error('Audio changed during finalization');const b=wrap(raw);if(b.length>archiveLimit)throw Error('A single audio chunk exceeds the Frosty archive size limit');if(w.size+b.length>archiveLimit)w=nextArchive(group,layer,catalog);let p=0;while(p<b.length)p+=fs.writeSync(w.fd,b,p,b.length-p);placement={offset:w.size,size:b.length,index:w.index};w.size+=b.length;w.cache.set(e.sha256,placement);}
   if(!tocChanges.has(layer))tocChanges.set(layer,Buffer.from(table.bytes));const t=tocChanges.get(layer);t[at+1]=layer==='Patch'?1:0;t[at+2]=catalog;t[at+3]=placement.index;t.writeUInt32BE(placement.offset,at+4);t.writeUInt32BE(placement.size,at+8);
  }
 }finally{for(const w of archives){fs.fsyncSync(w.fd);fs.closeSync(w.fd);}}
 for(const [layer,t]of tocChanges)fs.writeFileSync(path.join(stage,layer,'Win32/chunks0.toc'),t);
 // Verify every resolved audio, not just the resource count or presence of a FBMOD.
 const verifyTables={Data:readToc(stage,'Data'),Patch:readToc(stage,'Patch')};
 for(const e of m.entries){cancel();const layer=verifyTables.Patch.keys.has(e.key)?'Patch':'Data',t=verifyTables[layer],at=t.keys.get(e.key),w=archives.find(w=>w.group===layer+'/'+t.bytes[at+2]&&w.index===t.bytes[at+3]),offset=t.bytes.readUInt32BE(at+4),size=t.bytes.readUInt32BE(at+8);if(!w)throw Error('CAS reference mismatch');const b=Buffer.alloc(size),fd=fs.openSync(w.file,'r');try{if(fs.readSync(fd,b,0,size,offset)!==size)throw Error('Incomplete CAS');}finally{fs.closeSync(fd);}const raw=unwrap(b);if(raw.length!==e.bytes||sha(raw)!==e.sha256)throw Error('Installed audio verification failed: '+e.name);}
 for(const e of ownedCopies)if(!e.rel.toLowerCase().endsWith('/chunks0.toc')&&hash(path.join(stage,e.rel))!==e.sha256)throw Error('Another mod resource changed: '+e.rel);
 for(const [layer,t]of tocChanges){const expected=Buffer.from(tables[layer].bytes);for(const e of m.entries){const resolved=verifyTables.Patch.keys.has(e.key)?'Patch':'Data';if(resolved!==layer)continue;const at=tables[layer].keys.get(e.key);t.copy(expected,at,at,at+12);}if(!expected.equals(t))throw Error('Unrelated TOC data changed');}
 check();cancel();if(sourceStamp(profile)!==startStamp)throw Error('Frosty changed this profile during finalization. Wait for Frosty to finish and retry.');
 const receipt={schema:1,version:'4.3',profile:id,sourceProfile:profile,sourceStamp:startStamp,game,modFile:m.modFile,modSha256:m.modSha256,originalToc:m.originalToc,verifiedAudio:m.entries.length,preservedFiles:ownedCopies.length,created:new Date().toISOString(),tocSha256:Object.fromEntries([...tocChanges].map(([l,t])=>[l,sha(t)])),cas:archives.map(w=>({file:path.relative(stage,w.file),sha256:hash(w.file)}))};
 fs.writeFileSync(path.join(stage,'heatmusic-ready.json'),JSON.stringify(receipt,null,2),{flag:'wx'});fs.renameSync(stage,target);log('COMBINED_READY',target);log('VERIFIED_AUDIO',m.entries.length);return{target,receipt};
}
function validateLaunch(game,target){game=fs.realpathSync(game);target=fs.realpathSync(target);if(path.dirname(target).toLowerCase()!==path.join(game,'ModData').toLowerCase()||!/^HeatMusicCombined_\d+_[a-f0-9]{8}$/.test(path.basename(target)))throw Error('Invalid combined profile');const r=JSON.parse(fs.readFileSync(path.join(target,'heatmusic-ready.json')));if(r.schema!==1||r.verifiedAudio!==199||r.game!==game||r.profile!==path.basename(target))throw Error('Profile has no valid completion receipt');for(const l of ['Data','Patch'])if(!r.originalToc||hash(path.join(game,l,'Win32/chunks0.toc'))!==r.originalToc[l])throw Error('Original game version changed. Rebuild and finalize first.');if(sourceStamp(r.sourceProfile)!==r.sourceStamp)throw Error('The Frosty profile has changed. Finalize it again before playing.');for(const [l,h]of Object.entries(r.tocSha256))if(hash(path.join(target,l,'Win32/chunks0.toc'))!==h)throw Error('Combined TOC changed');for(const c of r.cas)if(hash(safeFile(target,c.file))!==c.sha256)throw Error('Combined audio archive changed');return r;}
if(require.main===module){try{const cfg=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));if(Object.keys(cfg).some(k=>!['mode','game','target','profile','bundle'].includes(k)))throw Error('Unexpected finalizer options');if(cfg.mode==='validate-launch'){noGame();const r=validateLaunch(cfg.game,cfg.target);console.log('LAUNCH_VALIDATED',r.profile);}else compose({...cfg,cancel:()=>{if(process.env.HEAT_MUSIC_CANCEL_FILE&&fs.existsSync(process.env.HEAT_MUSIC_CANCEL_FILE))throw Error('Cancelled safely; unfinished .partial folder is not playable.');}});}catch(e){console.error('FINALIZE_ERROR',e.stack||e.message);process.exitCode=1;}}
module.exports={exportCompanion,compose,loadBundle,tocIndex,wrap,unwrap,hash,validateLaunch};

'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert'),crypto=require('crypto');
const {spawnSync}=require('child_process');
const {applyLayeredOverlay,wrapEa}=require('./HeatMusicV5LayeredOverlay');
const {writeLocation,locateChunk}=require('./HeatMusicCasAddress');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'heat-relocated-toc-'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const save=(file,bytes)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);};
const z=s=>Buffer.from(s+'\0');
const obj=(name,children,list=false)=>Buffer.concat([Buffer.from([list?1:2]),z(name),Buffer.from([0]),...children,Buffer.from([0])]);
const str=(name,s)=>Buffer.concat([Buffer.from([7]),z(name),Buffer.from([s.length+1]),z(s)]);
const int=(name,n)=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return Buffer.concat([Buffer.from([8]),z(name),b]);};
const layout=obj('',[obj('installManifest',[obj('installChunks',[obj('',[int('persistentIndex',1),str('installBundle','Win32/configurations/superbundleinstallpackage2')])],true)])]);
const catalog='Win32/configurations/superbundleinstallpackage2';
const guid=n=>(0x11223340+n).toString(16)+'-4455-6677-8899-aabbccddeeff';
// Literal disk GUID format independently specified, not the production encoder.
function diskGuid(n){const b=Buffer.from('ffeeddccbbaa99886677445500000000','hex');b.writeUInt32BE(0x11223340+n,12);return b;}
const raw=Buffer.from('FULL CUSTOM SONG'),wrapped=wrapEa(raw),original=wrapEa(Buffer.from('ORIGINAL MUSIC'));
function makeToc(ids,patch,relocated){
 const base=relocated?1200:1000,b=Buffer.alloc(base+ids.length*12+64);
 b.writeUInt32BE(600-556,572);b.writeUInt32BE(ids.length,576);b.writeUInt32BE(base-556,580);
 ids.forEach((id,i)=>{const slot=relocated?ids.length-1-i:i;
  diskGuid(id).copy(b,600+i*20);b.writeUInt32BE(slot*3,600+i*20+16);
  writeLocation(b,base+slot*12,{patch,catalog:1,cas:patch?14:8,offset:0,size:original.length});
 });return b;
}
let sequence=0;
function fixture(){
 const dir=path.join(root,String(++sequence)),game=path.join(dir,'game'),staging=path.join(dir,'staging'),build=path.join(dir,'build');
 save(path.join(staging,'Patch/layout.toc'),layout);
 const snapshot={};
 for(const [layer,ids] of [['Data',[0,99]],['Patch',[1,2,3,4,5,6,7,99]]]){
  save(path.join(game,layer,'Win32/chunks0.toc'),makeToc(ids,layer==='Patch',false));
  const staged=makeToc(ids,layer==='Patch',true);snapshot[layer]=Buffer.from(staged);
  save(path.join(staging,layer,'Win32/chunks0.toc'),staged);
  for(const base of [game,staging])save(path.join(base,layer,catalog,layer==='Patch'?'cas_14.cas':'cas_08.cas'),original);
 }
 const dataToc=fs.readFileSync(path.join(game,'Data/Win32/chunks0.toc')),patchToc=fs.readFileSync(path.join(game,'Patch/Win32/chunks0.toc'));
 const row=(n,toc)=>{const at=locateChunk(toc,guid(n));return {name:'music-'+n,chunkId:guid(n),tocOffset:at,oldLocation:toc.subarray(at,at+12).toString('hex'),audioBytes:raw.length,audioSha256:hash(raw),audioFile:'patch.ealayer3',cas:8,newOffset:0,newSize:wrapped.length};};
 const manifest={id:'build',frostyPayloadMode:'metadata-with-layered-audio-overlay',placements:[row(0,dataToc)],patchAudio:row(1,patchToc),patchExtras:[2,3,4,5,6,7].map(n=>row(n,patchToc))};
 save(path.join(build,'manifest.json'),JSON.stringify(manifest));save(path.join(build,'chunks0.toc'),dataToc);
 save(path.join(build,'cas_08.cas'),wrapped);save(path.join(build,'patch.ealayer3'),raw);
 return {game,staging,buildDir:build,gameRoot:game,manifest,snapshot};
}
const good=fixture();assert.equal(applyLayeredOverlay(good).checked,8);
for(const [layer,rows] of [['Data',good.manifest.placements],['Patch',[good.manifest.patchAudio,...good.manifest.patchExtras]]]){
 const before=good.snapshot[layer],after=fs.readFileSync(path.join(good.staging,layer,'Win32/chunks0.toc')),mask=new Uint8Array(before.length);
 for(const row of rows){const at=locateChunk(before,row.chunkId);assert.notEqual(at,row.tocOffset);mask.fill(1,at,at+12);}
 assert.equal(after.length,before.length);
 for(let i=0;i<before.length;i++)if(!mask[i])assert.equal(after[i],before[i],layer+' non-music byte '+i);
 const cas=layer==='Patch'?'cas_14.cas':'cas_08.cas';assert.deepEqual(fs.readFileSync(path.join(good.game,layer,catalog,cas)),original);
}
const missing=fixture();const missingFile=path.join(missing.staging,'Patch/Win32/chunks0.toc');
const missingToc=fs.readFileSync(missingFile);diskGuid(98).copy(missingToc,600);save(missingFile,missingToc);
assert.throws(()=>applyLayeredOverlay(missing),/found 0/);
const duplicate=fixture(),duplicateFile=path.join(duplicate.staging,'Patch/Win32/chunks0.toc'),duplicateToc=fs.readFileSync(duplicateFile);
diskGuid(1).copy(duplicateToc,620);save(duplicateFile,duplicateToc);assert.throws(()=>applyLayeredOverlay(duplicate),/found 2/);
const conflict=fixture(),conflictFile=path.join(conflict.staging,'Data/Win32/chunks0.toc'),conflictToc=fs.readFileSync(conflictFile);
conflictToc.writeUInt32BE(1,locateChunk(conflictToc,guid(0))+4);save(conflictFile,conflictToc);
assert.throws(()=>applyLayeredOverlay(conflict),/conflicts with another selected mod/);
const stale=fixture();stale.manifest.patchAudio.oldLocation='00'.repeat(12);save(path.join(stale.buildDir,'manifest.json'),JSON.stringify(stale.manifest));
assert.throws(()=>applyLayeredOverlay(stale),/identity no longer matches/);
// Manager errors persist after the UI closes; invalid config never starts Frosty.
const config=path.join(root,'session/config.json');save(config,'{}');
const run=spawnSync(process.execPath,[path.join(__dirname,'FrostyGplManager.js'),config],{encoding:'utf8',windowsHide:true});
assert.equal(run.status,1);const logs=fs.readdirSync(path.join(root,'session/logs'));assert.equal(logs.length,1);
const events=fs.readFileSync(path.join(root,'session/logs',logs[0]),'utf8').trim().split('\n').map(JSON.parse);
assert.equal(events[0].type,'log-file');assert.equal(events.at(-1).type,'error');assert.match(events.at(-1).message,/NFS Heat executable/);
console.log('PASS relocated Data/Patch actual writer; 7 Patch resources; unrelated bytes/source CAS preserved; missing/duplicate GUID, real conflict and stale identity rejected; persistent error log.');
console.log('Fixtures: '+root);

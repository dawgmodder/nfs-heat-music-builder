'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert');
const {compose,exportCompanion,hash,wrap,unwrap,tocIndex,validateLaunch}=require('./HeatMusicFrostyCompanion');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'heat-companion-test-')),game=path.join(root,'game'),build=path.join(root,'HeatMusic_20261012131543_553f45'),exportsDir=path.join(root,'exports'),profile=path.join(game,'ModData/custom');
function put(p,b){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b);}
function toc(keys){const g=640,loc=g+keys.length*20,b=Buffer.alloc(loc+keys.length*12+16);b.writeUInt32BE(g-556,572);b.writeUInt32BE(keys.length,576);b.writeUInt32BE(loc-556,580);keys.forEach((key,i)=>{Buffer.from(key,'hex').copy(b,g+i*20);b.writeUInt32BE(i*3,g+i*20+16);b[loc+i*12+3]=1;});return b;}
const raw=Buffer.alloc(28);raw.writeUInt32BE(0x4800000c);raw[4]=0x16;raw[5]=4;raw.writeUInt16BE(48000,6);raw.writeUInt32BE(0x4000bb80,8);raw.writeUInt32BE(0x4400000c,12);raw.writeUInt32BE(48000,16);raw.writeUInt32BE(0x45000004,24);
assert.deepStrictEqual(unwrap(wrap(raw)),raw);assert.throws(()=>unwrap(wrap(raw).subarray(0,17)));
put(path.join(game,'NeedForSpeedHeat.exe'),'fixture');put(path.join(build,'audio/song.ealayer3'),raw);
const entries=[],rows=[];
for(const [layer,start,count]of [['Data',0,192],['Patch',192,7]]){const keys=Array.from({length:count},(_,i)=>(i+start+1).toString(16).padStart(32,'0')),b=toc(keys),index=tocIndex(b);put(path.join(game,layer,'Win32/chunks0.toc'),b);put(path.join(game,layer,'Win32/configurations/superbundleinstallpackage/cas_01.cas'),'original');for(const key of keys){const name='wave/'+key,item={name,tocOffset:index.keys.get(key),audioBytes:raw.length,audioSha256:hash(path.join(build,'audio/song.ealayer3')),seconds:1};entries.push(item);rows.push([name,raw.length,1,'audio/song.ealayer3'].join('\t'));}}
put(path.join(build,'waves.tsv'),rows.join('\n'));put(path.join(build,'manifest.json'),JSON.stringify({id:path.basename(build),placements:entries.slice(0,192),patchAudio:entries[192],patchExtras:entries.slice(193)}));
const mod=path.join(exportsDir,'NFSHeatCustomSoundtrack_'+path.basename(build)+'.fbmod');put(mod,'fixture metadata');const bundle=exportCompanion({game,build,modFile:mod,output:exportsDir});
fs.mkdirSync(profile,{recursive:true});fs.symlinkSync(path.join(game,'Data'),path.join(profile,'Data'),'junction');fs.cpSync(path.join(game,'Patch'),path.join(profile,'Patch'),{recursive:true});put(path.join(profile,'Patch/mods.json'),JSON.stringify([{file_name:'UNITE.fbmod'},{file_name:path.basename(mod)}]));put(path.join(profile,'Patch/other-mod.sb'),'preserve other mod');
const sourceHash=hash(path.join(profile,'Patch/Win32/chunks0.toc')),baseHash=hash(path.join(game,'Data/Win32/chunks0.toc'));
const args={game,profile,bundle,outputRoot:path.join(root,'combined'),check:()=>{},log:()=>{}};
const done=compose(args);assert.equal(done.receipt.verifiedAudio,199);assert.equal(fs.readFileSync(path.join(done.target,'Patch/other-mod.sb'),'utf8'),'preserve other mod');assert.equal(hash(path.join(profile,'Patch/Win32/chunks0.toc')),sourceHash);assert.equal(hash(path.join(game,'Data/Win32/chunks0.toc')),baseHash);
assert.throws(()=>compose({...args,profile:game}),/directly inside/);
assert.throws(()=>compose({...args,check:()=>{throw Error('game running');}}),/game running/);
assert.throws(()=>compose({...args,cancel:()=>{throw Error('cancelled');}}),/cancelled/);
const mods=path.join(profile,'Patch/mods.json'),goodMods=fs.readFileSync(mods);put(mods,'[]');assert.throws(()=>compose(args),/matching soundtrack LAST/);put(mods,goodMods);
const bundleData=JSON.parse(fs.readFileSync(bundle)),audio=path.join(path.dirname(bundle),bundleData.entries[0].audio),goodAudio=fs.readFileSync(audio);put(audio,raw.subarray(0,20));assert.throws(()=>compose(args),/EA/);put(audio,goodAudio);
let changed=false;assert.throws(()=>compose({...args,cancel:()=>{if(!changed&&fs.existsSync(args.outputRoot)&&fs.readdirSync(args.outputRoot).some(n=>n.endsWith('.partial'))){put(path.join(profile,'Patch/other-mod.sb'),'changed concurrently');changed=true;}}}),/changed this profile/);
const variant=Buffer.from(raw);variant[20]=1;const variantFile=path.join(path.dirname(bundle),'audio/variant.ealayer3');put(variantFile,variant);bundleData.entries[1].audio='audio/variant.ealayer3';bundleData.entries[1].sha256=hash(variantFile);put(bundle,JSON.stringify(bundleData));
const rollover=compose({...args,outputRoot:undefined,archiveLimit:36});assert.equal(rollover.receipt.cas.length,3);assert.equal(validateLaunch(game,rollover.target).verifiedAudio,199);
const archive=path.join(rollover.target,rollover.receipt.cas[0].file),archiveBytes=fs.readFileSync(archive);put(archive,Buffer.alloc(archiveBytes.length));assert.throws(()=>validateLaunch(game,rollover.target),/archive changed/);put(archive,archiveBytes);
put(path.join(profile,'Patch/other-mod.sb'),'new selection');assert.throws(()=>validateLaunch(game,rollover.target),/profile has changed/);
console.log('PASS: 199 resolved hashes, CAS boundaries/truncation, source and original immutability, other-mod preservation, wrong profile, active game, cancellation, wrong mod order, corrupted audio, concurrent Frosty change.');console.log('TEST_FIXTURES',root);
console.log('PASS: CAS rollover, deduplication across archives, launch validation, corrupted archive and stale profile refusal.');

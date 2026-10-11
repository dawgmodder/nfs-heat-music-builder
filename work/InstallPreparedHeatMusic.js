const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {spawnSync}=require('child_process');
const {checkCancellation}=require('./HeatMusicCancellation');
const paths=require('./HeatMusicPaths');
const {runFrostyApply}=require('./RunFrostyApply');
async function main(){
const workspace=path.resolve(__dirname,'..');
const game=paths.game;
const modData=path.join(game,'ModData');
const baseline=path.join(modData,'HeatTrack24RaceIntroAudioTest');
const applier=path.resolve(__dirname,'ApplyHeatTrack24Size.exe');
const folder=process.argv[2] ? path.resolve(process.argv[2]) : '';
const allowedRoot=path.resolve(workspace,'output','custom-builds');
const id=path.basename(folder);
const attempt=process.argv[3]||'';
if(attempt&&!/^retry[1-9][0-9]?$/.test(attempt))throw new Error('Unsafe install attempt suffix');
const targetId=attempt?id+'_'+attempt:id;
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
checkCancellation();
if(path.dirname(folder)!==allowedRoot || !/^HeatMusic_[A-Za-z0-9_]{10,40}$/.test(id))
  throw new Error('Unsafe prepared build path');
const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
const metadataFile=manifest.metadataFile||'metadata.fbmod';
const generatedToc=path.join(folder,'chunks0.toc');
const casOutputs={8:path.join(folder,'cas_08.cas'),13:path.join(folder,'cas_13.cas'),14:path.join(folder,'cas_14.cas')};
const sourceData=path.join(baseline,'Data');
const audioTarget=path.join(modData,targetId+'Audio');
const resourcesName=targetId+'Resources';
const finalTarget=path.join(modData,targetId);
if(manifest.id!==id || manifest.placements.length<19 || sha(generatedToc)!==manifest.tocSha256 ||
   !fs.existsSync(path.join(folder,metadataFile)) || !fs.existsSync(sourceData) || !fs.existsSync(applier))
  throw new Error('Prepared build failed preflight');
for(const n of [8,13,14]) if(fs.statSync(casOutputs[n]).size!==manifest.casBytes[n])
  throw new Error('Prepared CAS size mismatch: '+n);
for(const target of [audioTarget,path.join(modData,resourcesName),finalTarget])
  if(path.dirname(target)!==modData || fs.existsSync(target)) throw new Error('Unsafe or existing target: '+target);
const ready=spawnSync(applier,['ready'],{cwd:workspace,encoding:'utf8',timeout:30000,
  windowsHide:true,maxBuffer:1024*1024});
if(ready.status!==0)throw new Error('No-launch Frosty preflight failed: '+
  String(ready.error||ready.stderr||ready.stdout).slice(-1200));
console.log('NO_LAUNCH_FROSTY_READY');
function linkFile(src,dst){
  try{fs.linkSync(src,dst);}catch(error){
    if(!['EXDEV','EPERM','EACCES'].includes(error.code))throw error;
    fs.copyFileSync(src,dst,fs.constants.COPYFILE_EXCL);
  }
}
function link(src,dst){if(fs.statSync(src).isDirectory())fs.symlinkSync(src,dst,'junction');else linkFile(src,dst);}
function cloneData(src,dst,relative=''){
  fs.mkdirSync(dst);
  for(const name of fs.readdirSync(src)){
    const from=path.join(src,name),to=path.join(dst,name),rel=path.join(relative,name).toLowerCase();
    if(rel==='win32\\chunks0.toc'){linkFile(generatedToc,to);continue;}
    const casMatch=rel.match(/^win32\\configurations\\superbundleinstallpackage2?\\cas_(08|13|14)\.cas$/);
    if(casMatch){const n=Number(casMatch[1]);
      if((n===8&&rel.includes('superbundleinstallpackage2')) ||
        ((n===13||n===14)&&!rel.includes('superbundleinstallpackage2'))){linkFile(casOutputs[n],to);continue;}}
    const ancestor=['win32','win32\\configurations',
      'win32\\configurations\\superbundleinstallpackage',
      'win32\\configurations\\superbundleinstallpackage2'].includes(rel);
    if(ancestor)cloneData(from,to,rel);else link(from,to);
  }
}
// Once ModData creation starts, finish the critical install before honoring a close request.
checkCancellation();
console.log('INSTALL_CRITICAL_SECTION_BEGIN');
fs.mkdirSync(audioTarget);
link(path.join(baseline,'Patch'),path.join(audioTarget,'Patch'));
if(fs.existsSync(path.join(baseline,'Update')))link(path.join(baseline,'Update'),path.join(audioTarget,'Update'));
cloneData(sourceData,path.join(audioTarget,'Data'));
if(sha(path.join(audioTarget,'Data','Win32','chunks0.toc'))!==manifest.tocSha256)
  throw new Error('Installed audio TOC mismatch');
console.log('AUDIO_INSTALLED',audioTarget);
console.log('APPLYING_METADATA',resourcesName,'without launching the game');
const apply=await runFrostyApply(applier,['dynamic',folder,metadataFile,resourcesName],{folder,cwd:workspace});
console.log('FROSTY_STATUS',apply.status);
const patch=path.join(modData,resourcesName,'patch');
if(!fs.existsSync(path.join(patch,'win32','levels','mainlevel','mainlevel.sb')))
  throw new Error('Frosty metadata output missing');
fs.mkdirSync(finalTarget);
fs.symlinkSync(path.join(audioTarget,'Data'),path.join(finalTarget,'Data'),'junction');
if(manifest.patchAudio) {
  const patchItems=[manifest.patchAudio,...(manifest.patchExtras||[])];
  const patchTocRel=path.join('win32','chunks0.toc');
  const patchCasRel=path.join('win32','configurations','superbundleinstallpackage2','cas_14.cas');
  const originalPatch=path.join(game,'Patch');
  const tocSource=fs.existsSync(path.join(patch,patchTocRel))?path.join(patch,patchTocRel):path.join(originalPatch,'Win32','chunks0.toc');
  const casSource=fs.existsSync(path.join(patch,patchCasRel))?path.join(patch,patchCasRel):
    path.join(originalPatch,'Win32','configurations','superbundleinstallpackage2','cas_14.cas');
  const patchToc=fs.readFileSync(tocSource);
  const generatedPatchToc=path.join(folder,'installed-patch-'+targetId+'-chunks0.toc');
  const generatedPatchCas=path.join(folder,'installed-patch-'+targetId+'-cas_14.cas');
  fs.writeFileSync(generatedPatchToc,patchToc,{flag:'wx'});
  fs.copyFileSync(casSource,generatedPatchCas,fs.constants.COPYFILE_EXCL);
  const seenPatch=new Set();
  for(const item of patchItems){
    const p=item.tocOffset,relative=item.audioFile||'playlist-patch.ealayer3';
    const audioFile=path.resolve(folder,relative);
    if(!audioFile.startsWith(folder+path.sep)||seenPatch.has(p))
      throw new Error('Unsafe or duplicate Patch audio: '+item.name);
    seenPatch.add(p);
    if(patchToc.subarray(p,p+12).toString('hex')!==item.oldLocation)
      throw new Error('Frosty Patch TOC changed the target audio location: '+item.name);
    const raw=fs.readFileSync(audioFile);
    if(raw.length!==item.audioBytes||sha(audioFile)!==item.audioSha256)
      throw new Error('Patch audio checksum mismatch: '+item.name);
    const wrappedParts=[];
    for(let at=0;at<raw.length;){const n=Math.min(65536,raw.length-at),b=Buffer.allocUnsafe(n+8);
      b.writeUInt32BE(n,0);b.writeUInt16BE(n===65536?0x71:0x70,4);
      b.writeUInt16BE(n===65536?0:n,6);raw.copy(b,8,at,at+n);wrappedParts.push(b);at+=n;}
    const wrapped=Buffer.concat(wrappedParts),newOffset=fs.statSync(generatedPatchCas).size;
    patchToc[p+3]=14;
    patchToc.writeUInt32BE(newOffset,p+4);patchToc.writeUInt32BE(wrapped.length,p+8);
    fs.appendFileSync(generatedPatchCas,wrapped);
    item.newOffset=newOffset;item.newSize=wrapped.length;item.cas=14;
  }
  fs.writeFileSync(generatedPatchToc,patchToc);
  function clonePatch(src,dst,relative='') {
    fs.mkdirSync(dst);
    for(const name of fs.readdirSync(src)) {
      const from=path.join(src,name),to=path.join(dst,name),rel=path.join(relative,name).toLowerCase();
      if(rel===patchTocRel.toLowerCase()){linkFile(generatedPatchToc,to);continue;}
      if(rel===patchCasRel.toLowerCase()){linkFile(generatedPatchCas,to);continue;}
      if(['win32','win32\\configurations','win32\\configurations\\superbundleinstallpackage2'].includes(rel))
        clonePatch(from,to,rel);
      else link(from,to);
    }
  }
  clonePatch(patch,path.join(finalTarget,'Patch'));
  const targetToc=path.join(finalTarget,'Patch',patchTocRel);
  const targetCas=path.join(finalTarget,'Patch',patchCasRel);
  if(!fs.existsSync(targetToc)||!fs.existsSync(targetCas)||sha(targetToc)!==sha(generatedPatchToc))
    throw new Error('Installed Patch overlay mismatch');
  manifest.patchTocSha256=sha(generatedPatchToc);
  manifest.patchCasBytes=fs.statSync(generatedPatchCas).size;
  fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(manifest,null,2));
} else fs.symlinkSync(patch,path.join(finalTarget,'Patch'),'junction');
const launcher=path.join(folder,'Iniciar-'+targetId+'.cmd');
const isSteam=game.toLowerCase().includes(path.sep+'steamapps'+path.sep);
const launcherText=(isSteam?['@echo off','setlocal',
  'start "" "steam://run/1222680//-dataPath%%20%%22ModData%%2F'+targetId+'%%22/"',
  'echo NFS Heat launched with '+targetId+'.']:
  ['@echo off','echo In the EA App, open Manage ^> View properties.',
   'echo Paste into Advanced launch options:',
   'echo -dataPath "ModData/'+targetId+'"',
   'pause']).join('\r\n')+'\r\n';
fs.writeFileSync(launcher,launcherText,{flag:'wx'});
console.log('INSTALLED',finalTarget);
console.log('LAUNCHER',launcher);
console.log('IMPORTANT','Installation is complete. Start the game only with the generated mod launcher.');
}
main().catch(error=>{console.error('ERROR:',error.stack||error.message);process.exitCode=1;});

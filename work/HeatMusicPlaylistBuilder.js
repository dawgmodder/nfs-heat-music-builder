// Expands the proven 19-wave context build to every original licensed-playlist wave.
// Output stays isolated under custom-builds until InstallPreparedHeatMusic installs it.
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {spawn,spawnSync}=require('child_process');
const {checkCancellation}=require('./HeatMusicCancellation');
const normalizeUnsafe=require('./NormalizeUnsafeAudio');
const bitrateCandidates=require('./EaBitrateCandidates');
const {partialDuration,nextRequest}=require('./EaPartialDuration');
const paths=require('./HeatMusicPaths');
const audioCache=require('./HeatMusicAudioCache');
const {inspectEa}=require('./HeatMusicEaLayer3');
const {encodeSegment,POLICY}=require('./HeatMusicEaEncoder');
const {createFreshBuildFolder}=require('./HeatMusicBuildFolders');
const workspace=path.resolve(__dirname,'..');
const buildRoot=path.join(workspace,'output','custom-builds');
const ffmpeg=paths.ffmpeg;
const ffprobe=paths.ffprobe;
const decoder=path.join(__dirname,'DecodeOriginalEaForLoudness.exe');
const converterDir=paths.converterDir;
const converter=paths.converter;
const metadataBuilder=path.join(__dirname,'HeatTrack24SizeMod.exe');
const slots=['freeDriveDay','freeDriveNight','raceDay','raceNight','garage'];
const prefixes=['DC_','NC_','DI_','NI_','GA_'];
const references=[
  'DC_FelixJaehnBreakingBeattz_LIITA','NC_Logic_Mama_ShowLoveftYBNCordae',
  'DI_TheTribeOfGood_TurningUpForTheSunshine(Remix)','NI_MNKYBSNSS_OtroLugar',
  'GA_KingsOfTheRollers_GuitarTrack'];
const audioExtensions=new Set(['.wav','.mp3','.flac','.m4a']);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function run(exe,args,timeout=180000,options={}) {
  checkCancellation();
  const r=spawnSync(exe,args,{encoding:'utf8',windowsHide:true,timeout,maxBuffer:8*1024*1024,...options});
  if(r.status!==0)throw new Error(path.basename(exe)+' failed: '+String(r.error||r.stderr||r.stdout).slice(-1800));
  checkCancellation();
  return r;
}
function streamRun(exe,args,timeout) {
  return new Promise((resolve,reject)=>{
    try{checkCancellation();}catch(error){reject(error);return;}
    const child=spawn(exe,args,{cwd:workspace,windowsHide:true,stdio:'inherit'});
    const timer=setTimeout(()=>child.kill(),timeout);
    child.on('error',e=>{clearTimeout(timer);reject(e);});
    child.on('exit',code=>{clearTimeout(timer);
      if(code!==0){checkCancellation();reject(new Error(path.basename(exe)+' exited '+code));return;}
      try{checkCancellation();resolve();}catch(error){reject(error);}
    });
  });
}
function songs(dir) {
  if(!fs.existsSync(dir)||!fs.statSync(dir).isDirectory())throw new Error('Invalid playlist folder: '+dir);
  return fs.readdirSync(dir,{withFileTypes:true}).filter(e=>e.isFile()&&audioExtensions.has(path.extname(e.name).toLowerCase()))
    .map(e=>path.join(dir,e.name)).sort((a,b)=>path.basename(a).localeCompare(path.basename(b),'pt-BR',{numeric:true}));
}
function measure(file) {
  const r=run(ffmpeg,['-hide_banner','-nostats','-i',file,
    '-af','loudnorm=I=-18:TP=-1:LRA=11:print_format=json','-f','null','NUL'],120000);
  const m=r.stderr.match(/\{\s*"input_i"[\s\S]*?\}/);
  if(!m)throw new Error('Loudness not measured: '+file);
  const data=JSON.parse(m[0]);return {lufs:Number(data.input_i),truePeak:Number(data.input_tp)};
}
function duration(file) {
  const r=run(ffprobe,['-v','error','-show_entries','format=duration','-of','json',file],30000);
  const n=Number(JSON.parse(r.stdout).format.duration);
  if(!Number.isFinite(n)||n<20)throw new Error('Invalid duration (at least 20 s required): '+file);
  return n;
}
function trailingSilenceStart(file) {
  const wavSeconds=duration(file);
  const r=run(ffmpeg,['-hide_banner','-nostats','-i',file,
    '-af','silencedetect=noise=-60dB:d=0.5','-f','null','NUL'],120000);
  const starts=[...r.stderr.matchAll(/silence_start:\s*([\d.]+)/g)];
  const ends=[...r.stderr.matchAll(/silence_end:\s*([\d.]+)/g)];
  if(!starts.length||!ends.length)return null;
  const start=Number(starts.at(-1)[1]),end=Number(ends.at(-1)[1]);
  return Math.abs(end-wavSeconds)<0.2&&wavSeconds-start>=4&&wavSeconds-start<=30?start:null;
}
function normalize(source,folder,index) {
  const r=audioCache.memo('normalized',source,{},()=>normalizeUncached(source,folder,index),
    path.join(folder,'playlist-normal-'+index+'.wav'));
  const stat=fs.statSync(source);return {...r,duration:duration(r.wav),source,sourceBytes:stat.size,sourceMtimeMs:stat.mtimeMs};
}
function normalizeUncached(source,folder,index) {
  const wav=path.join(folder,'playlist-normal-'+index+'.wav');
  const cache=path.join(folder,'playlist-normal-'+index+'.json');
  const stat=fs.statSync(source);
  if(fs.existsSync(cache)&&fs.existsSync(wav)){
    const saved=JSON.parse(fs.readFileSync(cache,'utf8'));
    if(saved.source===source&&saved.sourceBytes===stat.size&&saved.sourceMtimeMs===stat.mtimeMs&&
        saved.wav===wav&&fs.statSync(wav).size>10000){
      console.log('REUSED_NORMALIZED_PLAYLIST',path.basename(source));
      return saved;
    }
  }
  const seconds=duration(source),before=measure(source),gain=-18-before.lufs+0.35;
  if(!Number.isFinite(before.lufs)||!Number.isFinite(before.truePeak))
    throw new Error('Invalid loudness: '+source);
  const unsafeGain=before.truePeak+gain>-1;
  if(!fs.existsSync(wav)){
    if(unsafeGain)normalizeUnsafe(source,wav,ffmpeg);
    else run(ffmpeg,['-hide_banner','-loglevel','error','-i',source,'-map','0:a:0',
      '-af','volume='+gain.toFixed(3)+'dB','-ar','48000','-ac','2','-c:a','pcm_s16le',wav],180000);
  }
  const after=measure(wav);
  if(Math.abs(after.lufs+17.65)>(unsafeGain?0.35:0.25)||after.truePeak>-0.9)
    throw new Error('Normalization outside the safe range: '+source);
  console.log('NORMALIZED_PLAYLIST',path.basename(source),before.lufs,'->',after.lufs,'LUFS');
  const result={source,wav,duration:seconds,before,after,gainDb:unsafeGain?null:gain,
    method:unsafeGain?'dynamic-compressor':'gain',
    sourceBytes:stat.size,sourceMtimeMs:stat.mtimeMs};
  fs.writeFileSync(cache,JSON.stringify(result));
  return result;
}
function encode(item,folder,index) {
  return audioCache.memo('playlist-full',item.wav,{duration:item.duration,eaPolicy:POLICY},()=>encodeUncached(item,folder,index),
    path.join(folder,'playlist-'+index+'-cached.ealayer3'),r=>inspectEa(r.file,r.seconds,0.01));
}
function encodeUncached(item,folder,index) {
  const seconds=duration(item.wav);
  const result=encodeSegment(item.wav,folder,'playlist-'+index,{seconds});
  const decoded=path.join(folder,'playlist-verify-'+index+'-'+result.sha256.slice(0,16)+'.wav');
  if(!fs.existsSync(decoded))run(decoder,[result.file,decoded],Math.max(180000,seconds*150));
  const reading=measure(decoded);
  if(Math.abs(reading.lufs+18)>0.3)throw new Error('EA Layer3 outside -18 ±0.3 LUFS: '+item.source+' '+reading.lufs);
  console.log('ENCODED_PLAYLIST',path.basename(item.source),result.seconds,reading.lufs,'LUFS');
  return {...result,reading};
}
function casWrap(raw) {
  const blocks=[];
  for(let p=0;p<raw.length;){const n=Math.min(65536,raw.length-p),b=Buffer.allocUnsafe(n+8);
    b.writeUInt32BE(n,0);b.writeUInt16BE(n===65536?0x71:0x70,4);
    b.writeUInt16BE(n===65536?0:n,6);raw.copy(b,8,p,p+n);blocks.push(b);p+=n;}
  return Buffer.concat(blocks);
}
function hashFile(file) {
  const hash=crypto.createHash('sha256'),buffer=Buffer.allocUnsafe(1024*1024);
  const fd=fs.openSync(file,'r');
  try{
    let bytes;
    while((bytes=fs.readSync(fd,buffer,0,buffer.length,null))>0)
      hash.update(buffer.subarray(0,bytes));
  }finally{fs.closeSync(fd);}
  return hash.digest('hex');
}
function baseEncodesByContent(manifest,audioDir) {
  const reused=new Map(),files=fs.readdirSync(audioDir).filter(name=>name.endsWith('.ealayer3'));
  for(let i=0;i<slots.length;i++){
    const slot=slots[i],source=manifest.slots&&manifest.slots[slot];
    const placement=manifest.placements[i],reading=manifest.encodedMeasurements&&manifest.encodedMeasurements[slot];
    if(!source||!fs.existsSync(source)||!placement||!placement.name.endsWith('/'+references[i])||
        !reading||!Number.isFinite(reading.lufs)||Math.abs(reading.lufs+18)>0.3)continue;
    const contentHash=hashFile(source);
    if(reused.has(contentHash))continue;
    const match=files.filter(name=>name.startsWith(slot+'-')).map(name=>path.join(audioDir,name))
      .find(file=>fs.statSync(file).size===placement.audioBytes&&hashFile(file)===placement.audioSha256);
    if(!match)continue;
    try{
      const ea=inspectEa(match,placement.seconds,0.01);
      reused.set(contentHash,{source,ea:{...ea,reading}});
    }catch(error){console.log('WARNING_PLAYLIST base audio rejected',slot,error.message);}
  }
  return reused;
}
function encodeDistinctSources(unique,normalizedDir,audioDir,manifest,
  normalizeSong=normalize,encodeSong=encode,baseByContent=new Map()) {
  const encoded=new Map(),byContent=new Map();
  for(let i=0;i<unique.length;i++){
    checkCancellation();
    const source=unique[i],contentHash=hashFile(source);
    const prior=byContent.get(contentHash);
    if(prior){
      encoded.set(source,prior.ea);
      console.log('REUSED_ENCODED_PLAYLIST',path.basename(source),'from',path.basename(prior.source));
      continue;
    }
    const base=baseByContent.get(contentHash);
    if(base){
      encoded.set(source,base.ea);
      byContent.set(contentHash,{source,ea:base.ea});
      console.log('REUSED_BASE_ENCODED_PLAYLIST',path.basename(source),'from',path.basename(base.source));
      continue;
    }
    const item=normalizeSong(source,normalizedDir,i+100);
    const ea=encodeSong(item,audioDir,i+100);
    encoded.set(source,ea);
    byContent.set(contentHash,{source,ea});
    manifest.normalization.push({source:item.source,before:item.before,after:item.after,gainDb:item.gainDb});
  }
  return encoded;
}
async function main() {
  checkCancellation();
  const configFile=process.argv[2];
  if(!configFile||!fs.existsSync(configFile))throw new Error('Configuration JSON required');
  const config=JSON.parse(fs.readFileSync(configFile,'utf8'));
  const inventory=JSON.parse(fs.readFileSync(path.join(workspace,'output','playlist-placements.json'),'utf8'));
  if(inventory.length!==71)throw new Error('Incomplete playlist inventory');
  const sources={};
  for(let i=0;i<5;i++) {
    const list=songs(config.slots[slots[i]]);
    const capacity=inventory.filter(w=>w.name.split('/').pop().startsWith(prefixes[i])).length;
    if(!list.length||list.length>capacity)throw new Error(slots[i]+': select 1 to '+capacity+' tracks in the folder; found '+list.length);
    sources[slots[i]]=list;
    console.log('PLAYLIST',slots[i],list.length,'tracks for',capacity,'original tracks');
  }
  for(const key of ['menu','introDay','introNight'])
    if(!fs.existsSync(config.slots[key])||!fs.statSync(config.slots[key]).isFile())
      throw new Error('Required file: '+key);
  for(const file of [ffmpeg,ffprobe,decoder,converter,metadataBuilder])
    if(!fs.existsSync(file))throw new Error('Missing local tool: '+file);
  const baseConfig={slots:{...config.slots},dropDaySeconds:config.dropDaySeconds,
    dropNightSeconds:config.dropNightSeconds};
  for(const key of slots)baseConfig.slots[key]=sources[key][0];
  const configDir=path.join(workspace,'output','builder-configs');fs.mkdirSync(configDir,{recursive:true});
  const resumeIndex=process.argv.indexOf('--resume');
  const resumeId=resumeIndex>=0?process.argv[resumeIndex+1]:null;
  if(resumeIndex>=0&&!/^HeatMusic_\d{14}_[0-9a-f]{6}$/.test(resumeId||''))
    throw new Error('Invalid resume ID');
  const baseConfigPath=path.join(configDir,'playlist-base-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex')+'.json');
  fs.writeFileSync(baseConfigPath,JSON.stringify(baseConfig));
  const buildId=resumeId||'HeatMusic_'+new Date().toISOString().replace(/[-:T.Z]/g,'').slice(0,14)+'_'+crypto.randomBytes(3).toString('hex');
  const folder=path.join(buildRoot,buildId);
  if(resumeId){if(!fs.existsSync(folder))throw new Error('Resume package not found: '+folder);}
  else createFreshBuildFolder(buildRoot,buildId);
  const manifestFile=path.join(folder,'manifest.json');
  if(!fs.existsSync(manifestFile)){
    console.log('PREPARING_BASE');
    await streamRun(process.execPath,[path.join(__dirname,'HeatMusicBuilder.js'),baseConfigPath,'--prepare-only','--resume',buildId],3600000);
  }
  const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
  if(manifest.placements.length!==19)throw new Error('Base package does not have 19 resources');
  const extras=[],assignment=new Map();
  for(let i=0;i<5;i++) {
    const group=inventory.filter(x=>x.name.split('/').pop().startsWith(prefixes[i]));
    const reference=group.find(x=>x.name.endsWith('/'+references[i]));
    if(!reference)throw new Error('Missing original reference: '+references[i]);
    assignment.set(reference.name.toLowerCase(),sources[slots[i]][0]);
    let cursor=1;
    for(const wave of group)if(wave!==reference){
      const source=sources[slots[i]][cursor%sources[slots[i]].length];cursor++;
      assignment.set(wave.name.toLowerCase(),source);extras.push(wave);
    }
  }
  const garage=inventory.filter(x=>x.name.split('/').pop().startsWith('GA_'));
  const visual=inventory.filter(x=>x.name.split('/').pop().startsWith('VS_'));
  if(garage.length!==12||visual.length!==12)throw new Error('Unexpected garage/visualization inventory');
  for(let i=0;i<12;i++){assignment.set(visual[i].name.toLowerCase(),assignment.get(garage[i].name.toLowerCase()));extras.push(visual[i]);}
  if(extras.length!==66)throw new Error('Expected 66 extra resources; found '+extras.length);
  const unique=[...new Set(extras.map(x=>assignment.get(x.name.toLowerCase())))];
  const normalizedDir=path.join(folder,'normalized'),audioDir=path.join(folder,'audio');
  const encoded=encodeDistinctSources(unique,normalizedDir,audioDir,manifest,
    normalize,encode,baseEncodesByContent(manifest,audioDir));
  const tocFile=path.join(folder,'chunks0.toc'),dataToc=fs.readFileSync(tocFile);
  const dataCasFile=path.join(folder,'cas_08.cas');let dataCursor=fs.statSync(dataCasFile).size;
  const patchWave=extras.find(x=>x.layer==='Patch');
  if(!patchWave||extras.filter(x=>x.layer==='Patch').length!==1)throw new Error('Patch playlist wave inventory changed');
  const patchTocFile=path.join(folder,'playlist-patch-chunks0.toc');
  const gameRoot=paths.game;
  const patchToc=fs.readFileSync(path.join(gameRoot,'Patch','Win32','chunks0.toc'));
  const patchEaFile=path.join(folder,'playlist-patch.ealayer3');
  const appendedNames=new Set();
  for(const wave of extras) {
    const source=assignment.get(wave.name.toLowerCase()),ea=encoded.get(source),p=wave.tocOffset;
    const targetToc=wave.layer==='Patch'?patchToc:dataToc;
    if(targetToc.subarray(p,p+12).toString('hex')!==wave.location)
      throw new Error('Original TOC changed: '+wave.name);
    if(appendedNames.has(wave.name.toLowerCase()))throw new Error('Duplicate wave: '+wave.name);
    appendedNames.add(wave.name.toLowerCase());
    const raw=fs.readFileSync(ea.file),wrapped=casWrap(raw);
    if(wave.layer==='Data'){
      if(dataCursor+wrapped.length>0xffffffff)throw new Error('Generated playlist CAS exceeds the 32-bit offset limit; use a smaller playlist');
      targetToc[p]=0;targetToc[p+1]=0;targetToc[p+2]=1;targetToc[p+3]=8;
      targetToc.writeUInt32BE(dataCursor,p+4);targetToc.writeUInt32BE(wrapped.length,p+8);
      fs.appendFileSync(dataCasFile,wrapped);
      manifest.placements.push({name:wave.name,layer:'Data',tocOffset:p,cas:8,newOffset:dataCursor,
        newSize:wrapped.length,audioBytes:ea.bytes,audioSha256:ea.sha256,seconds:ea.seconds,source});
      dataCursor+=wrapped.length;
    }else{
      fs.copyFileSync(ea.file,patchEaFile,fs.constants.COPYFILE_EXCL);
      manifest.patchAudio={name:wave.name,tocOffset:p,oldLocation:wave.location,
        audioBytes:ea.bytes,audioSha256:ea.sha256,seconds:ea.seconds,source};
    }
  }
  fs.writeFileSync(tocFile,dataToc);fs.writeFileSync(patchTocFile,patchToc,{flag:'wx'});
  manifest.tocSha256=sha(dataToc);manifest.casBytes[8]=dataCursor;
  manifest.playlists=Object.fromEntries(slots.map(key=>[key,sources[key]]));
  const waveFile=path.join(folder,'waves.tsv');
  fs.appendFileSync(waveFile,extras.map(w=>{const ea=encoded.get(assignment.get(w.name.toLowerCase()));
    return [w.name,ea.bytes,ea.seconds,path.relative(folder,ea.file).replace(/\\/g,'/')].join('\t');}).join('\n')+'\n');
  manifest.metadataFile='playlist-metadata.fbmod';
  fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2));
  console.log('BUILDING_FULL_PLAYLIST_METADATA',manifest.placements.length,'Data placements + 1 Patch placement');
  require('./RunHeatMetadata').runMetadata(metadataBuilder,
    ['dynamic',waveFile,path.join(folder,manifest.metadataFile)],{cwd:workspace});
  console.log('PREPARED_PLAYLIST',folder);
  if(process.argv.includes('--prepare-only'))return;
  await streamRun(process.execPath,[path.join(__dirname,'InstallPreparedHeatMusic.js'),folder],1500000);
}
if(require.main===module)main().catch(e=>{console.error('ERROR:',e.stack||e.message);process.exitCode=1;});
module.exports={encode,encodeDistinctSources,baseEncodesByContent};

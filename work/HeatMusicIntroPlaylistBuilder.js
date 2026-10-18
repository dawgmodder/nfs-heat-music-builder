// Version 2: fills all existing race-intro sequences with songs from two folders.
// It never writes to the game's original Data/Patch directories.
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
const root=path.resolve(__dirname,'..');
const game=paths.game;
const ffmpeg=paths.ffmpeg;
const ffprobe=paths.ffprobe;
const converterDir=paths.converterDir;
const converter=paths.converter;
const decoder=path.join(__dirname,'DecodeOriginalEaForLoudness.exe');
const metadataBuilder=path.join(__dirname,'HeatTrack24SizeMod.exe');
const buildRoot=path.join(root,'output','custom-builds');
const inventoryFile=path.join(root,'output','race-intro-track24-test','all-inventory.tsv');
const audioExtensions=new Set(['.mp3','.wav','.flac','.m4a']);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const hashFile=f=>sha(fs.readFileSync(f));
const encodedSegments=new Map();
const normalizedByContent=new Map();
const reuseStats={encodedRace:0,reusedRace:0,encodedLead:0,reusedLead:0,normalized:0};
const segmentKey=(item,race,start,nominal)=>
  [item.wav,race?'race':'intro',start.toFixed(6),nominal.toFixed(6)].join('|');
function run(exe,args,timeout=180000,options={}){
  checkCancellation();
  const r=spawnSync(exe,args,{encoding:'utf8',windowsHide:true,timeout,maxBuffer:8*1024*1024,...options});
  if(r.status!==0)throw new Error(path.basename(exe)+' failed: '+String(r.error||r.stderr||r.stdout).slice(-2000));
  checkCancellation();
  return r;
}
function streamRun(exe,args,timeout){return new Promise((resolve,reject)=>{
  try{checkCancellation();}catch(error){reject(error);return;}
  const child=spawn(exe,args,{cwd:root,windowsHide:true,stdio:'inherit'});
  const timer=setTimeout(()=>child.kill(),timeout);
  child.on('error',e=>{clearTimeout(timer);reject(e);});
  child.on('exit',code=>{clearTimeout(timer);
    if(code!==0){checkCancellation();reject(new Error(path.basename(exe)+' exited '+code));return;}
    try{checkCancellation();resolve();}catch(error){reject(error);}
  });
});}
function songs(dir){
  if(!fs.existsSync(dir)||!fs.statSync(dir).isDirectory())throw new Error('Invalid race intro folder: '+dir);
  return fs.readdirSync(dir,{withFileTypes:true}).filter(e=>e.isFile()&&audioExtensions.has(path.extname(e.name).toLowerCase()))
    .map(e=>path.join(dir,e.name)).sort((a,b)=>path.basename(a).localeCompare(path.basename(b),'pt-BR',{numeric:true}));
}
function duration(file){const r=run(ffprobe,['-v','error','-show_entries','format=duration','-of','json',file],30000);
  const n=Number(JSON.parse(r.stdout).format.duration);
  if(!Number.isFinite(n)||n<20)throw new Error('Invalid duration (at least 20 s required): '+file);
  return n;}
function measure(file){const r=run(ffmpeg,['-hide_banner','-nostats','-i',file,
  '-af','loudnorm=I=-18:TP=-1:LRA=11:print_format=json','-f','null','NUL'],120000);
  const m=r.stderr.match(/\{\s*"input_i"[\s\S]*?\}/);
  if(!m)throw new Error('Loudness not measured: '+file);
  const data=JSON.parse(m[0]);return{lufs:Number(data.input_i),truePeak:Number(data.input_tp)};}
function audibleEnd(item){
  if(Number.isFinite(item.audibleEnd))return item.audibleEnd;
  const r=run(ffmpeg,['-hide_banner','-nostats','-i',item.wav,
    '-af','silencedetect=noise=-60dB:d=0.5','-f','null','NUL'],120000);
  const starts=[...r.stderr.matchAll(/silence_start:\s*([\d.]+)/g)];
  const ends=[...r.stderr.matchAll(/silence_end:\s*([\d.]+)/g)];
  const start=starts.length?Number(starts.at(-1)[1]):null;
  const end=ends.length?Number(ends.at(-1)[1]):null;
  item.audibleEnd=start!==null&&end!==null&&Math.abs(end-item.duration)<0.2&&
    item.duration-start>=1&&item.duration-start<=30?start:item.duration;
  return item.audibleEnd;
}
function normalize(source,folder,index){
  const r=audioCache.memo('normalized',source,{},()=>normalizeUncached(source,folder,index),
    path.join(folder,'intro-normal-'+index+'.wav'));
  const stat=fs.statSync(source);return {...r,duration:duration(r.wav),source,sourceBytes:stat.size,sourceMtimeMs:stat.mtimeMs};
}
function normalizeUncached(source,folder,index){
  const wav=path.join(folder,'intro-normal-'+index+'.wav');
  const cache=path.join(folder,'intro-normal-'+index+'.json');
  const stat=fs.statSync(source);
  if(fs.existsSync(cache)&&fs.existsSync(wav)){
    const saved=JSON.parse(fs.readFileSync(cache,'utf8'));
    if(saved.source===source&&saved.sourceBytes===stat.size&&saved.sourceMtimeMs===stat.mtimeMs&&
      saved.wav===wav&&fs.statSync(wav).size>10000)return saved;
  }
  // Playlist songs are also the intro songs. Reuse their already measured and
  // normalized WAV when the staged files have identical contents.
  if(!normalizedByContent.size){
    for(const name of fs.readdirSync(folder).filter(x=>/^playlist-normal-\d+\.json$/.test(x))){
      const prior=JSON.parse(fs.readFileSync(path.join(folder,name),'utf8'));
      const priorStat=fs.existsSync(prior.source)?fs.statSync(prior.source):null;
      if(priorStat&&priorStat.size===prior.sourceBytes&&
        priorStat.mtimeMs===prior.sourceMtimeMs&&
        fs.existsSync(prior.wav)&&path.dirname(prior.wav)===folder&&
        Number.isFinite(prior.duration)&&Number.isFinite(prior.after&&prior.after.lufs)&&
        Math.abs(prior.after.lufs+17.65)<=0.35&&prior.after.truePeak<=-0.9)
        normalizedByContent.set(hashFile(prior.source),prior);
    }
    const manifestFile=path.join(path.dirname(folder),'manifest.json');
    if(fs.existsSync(manifestFile)){
      const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
      for(const prior of manifest.normalization||[]){
        if(prior.source&&prior.wav&&fs.existsSync(prior.source)&&
          fs.existsSync(prior.wav)&&path.dirname(prior.wav)===folder&&
          Number.isFinite(prior.duration)&&Number.isFinite(prior.after&&prior.after.lufs)&&
          Math.abs(prior.after.lufs+17.65)<=0.35&&prior.after.truePeak<=-0.9)
          normalizedByContent.set(hashFile(prior.source),prior);
      }
    }
  }
  const prior=normalizedByContent.get(hashFile(source));
  if(prior){
    reuseStats.normalized++;
    console.log('REUSED_NORMALIZED_INTRO',path.basename(source),'from prior build stage');
    return {...prior,source,sourceBytes:stat.size,sourceMtimeMs:stat.mtimeMs};
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
  const result={source,wav,duration:seconds,before,after,gainDb:unsafeGain?null:gain,
    method:unsafeGain?'dynamic-compressor':'gain',
    sourceBytes:stat.size,sourceMtimeMs:stat.mtimeMs};
  fs.writeFileSync(cache,JSON.stringify(result));
  console.log('NORMALIZED_INTRO',path.basename(source),before.lufs,'->',after.lufs,'LUFS');
  return result;
}
function encode(item,row,folder,drop,pre){
  const race=row.index===5,start=race?drop:drop-pre+row.startOffset;
  return audioCache.memo('intro-segment',item.wav,{eaPolicy:POLICY,race,start,seconds:race?item.duration-drop-0.1:row.oldSeconds},
    ()=>encodeUncached(item,row,folder,drop,pre),path.join(folder,'intro-'+row.chunkId+'-cached.ealayer3'),
    r=>inspectEa(r.file,r.seconds,0.01));
}
function encodeUncached(item,row,folder,drop,pre){
  const race=row.index===5,start=race?drop:drop-pre+row.startOffset;
  const nominal=race?item.duration-drop-0.1:row.oldSeconds;
  const key=segmentKey(item,race,start,nominal),reused=encodedSegments.get(key);
  if(reused){reuseStats[race?'reusedRace':'reusedLead']++;return reused;}
  const result=encodeSegment(item.wav,folder,'intro-v2-'+row.chunkId,{start,seconds:nominal});
  if(race){const loss=Math.max(0,audibleEnd(item)-(drop+result.seconds));
    if(loss>1.25)throw new Error('Race intro would lose '+loss.toFixed(2)+' audible seconds: '+row.assetName);}
  const encoded={...result,start,requested:nominal};encodedSegments.set(key,encoded);
  reuseStats[race?'encodedRace':'encodedLead']++;return encoded;
}
function guidBytes(id){const b=Buffer.from(id.replace(/-/g,''),'hex');
  if(b.length!==16)throw new Error('Invalid GUID: '+id);
  return Buffer.from([...b.subarray(0,4)].reverse().concat(
    [...b.subarray(4,6)].reverse(),[...b.subarray(6,8)].reverse(),[...b.subarray(8)])).reverse();}
function chunkLocator(originalToc){
  const guidStart=originalToc.readUInt32BE(572)+556,count=originalToc.readUInt32BE(576);
  const locStart=originalToc.readUInt32BE(580)+556;
  if(count<1||count>100000)throw new Error('TOC format changed');
  const map=new Map();
  for(let i=0;i<count;i++){const p=guidStart+i*20;
    const flags=originalToc.readUInt32BE(p+16),index=(flags&0xffffff)/3;
    if(Number.isInteger(index))map.set(originalToc.subarray(p,p+16).toString('hex'),locStart+index*12);}
  return id=>{const p=map.get(guidBytes(id).toString('hex'));
    if(!Number.isInteger(p)||p<0||p+12>originalToc.length)throw new Error('Chunk not found: '+id);
    return p;};
}
function casWrap(raw){const parts=[];
  for(let p=0;p<raw.length;){const n=Math.min(65536,raw.length-p),b=Buffer.allocUnsafe(n+8);
    b.writeUInt32BE(n,0);b.writeUInt16BE(n===65536?0x71:0x70,4);
    b.writeUInt16BE(n===65536?0:n,6);raw.copy(b,8,p,p+n);parts.push(b);p+=n;}
  return Buffer.concat(parts);}
function inventory(){const lines=fs.readFileSync(inventoryFile,'utf8').trim().split(/\r?\n/).slice(1);
  const groups={day:new Map(),night:new Map()};
  for(const line of lines){const [context,phrase,index,segmentName,assetName,chunkId,oldBytes,oldSeconds]=line.split('\t');
    if(!groups[context])throw new Error('Unknown race intro context');
    const row={context,phrase,index:Number(index),segmentName,assetName,chunkId,
      oldBytes:Number(oldBytes),oldSeconds:Number(oldSeconds)};
    if(!groups[context].has(phrase))groups[context].set(phrase,[]);
    groups[context].get(phrase).push(row);}
  if(lines.length!==126||groups.day.size!==10||groups.night.size!==11)
    throw new Error('Incomplete race intro inventory');
  for(const group of [...groups.day.values(),...groups.night.values()]){
    group.sort((a,b)=>a.index-b.index);
    if(group.length!==6||group.some((r,i)=>r.index!==i))throw new Error('Incomplete race intro');
    let offset=0;for(const row of group){row.startOffset=offset;if(row.index<5)offset+=row.oldSeconds;}
    group.preRace=offset;
  }
  return groups;}
function assignments(groups,lists){const chosen=[];
  for(const context of ['day','night']){
    const entries=[...groups[context].entries()];
    const tested=context==='day'?'DI_Intro_TOG_TurningUpForTheSunshine':'NI_Intro_MNKYBSNSS_OtroLugar';
    const ordered=[entries.find(([key])=>key===tested),...entries.filter(([key])=>key!==tested)];
    if(!ordered[0])throw new Error('Missing base race intro: '+tested);
    ordered.forEach(([phrase,rows],i)=>chosen.push({context,phrase,rows,source:lists[context][i%lists[context].length]}));
  }
  return chosen;}
async function main(){
  checkCancellation();
  const configFile=process.argv[2];if(!configFile||!fs.existsSync(configFile))throw new Error('Configuration JSON required');
  const config=JSON.parse(fs.readFileSync(configFile,'utf8'));
  const groups=inventory();
  const lists={day:songs(config.slots.introDay),night:songs(config.slots.introNight)};
  for(const context of ['day','night']){
    const cap=groups[context].size;
    if(!lists[context].length||lists[context].length>cap)
      throw new Error('Race intro '+context+': select 1 to '+cap+' tracks; found '+lists[context].length);
    console.log('INTRO_PLAYLIST',context,lists[context].length,'tracks for',cap,'sequences');
  }
  for(const file of [ffmpeg,ffprobe,converter,decoder,metadataBuilder,inventoryFile])
    if(!fs.existsSync(file))throw new Error('Missing local tool: '+file);
  const chosen=assignments(groups,lists);
  const dropFor=source=>{const n=Number(config.introDrops&&config.introDrops[source]);
    if(!Number.isFinite(n)||n<10||n>600)throw new Error('Drop not configured: '+source);
    return require('./HeatMusicTiming').raceStart(n);};
  const sourceDurations=new Map();
  for(const source of [...lists.day,...lists.night])sourceDurations.set(source,duration(source));
  for(const item of chosen){const drop=dropFor(item.source),seconds=sourceDurations.get(item.source);
    if(drop<=item.rows.preRace+0.1||drop>=seconds-1)
      throw new Error('Invalid drop for '+path.basename(item.source)+' / '+item.phrase+': '+(drop+1)+
        ' s; including race-start compensation, this sequence requires at least '+(Math.ceil((item.rows.preRace+1.10001)*10)/10).toFixed(1)+
        ' s and more than 1 s remaining in the song');}
  const originalToc=fs.readFileSync(path.join(game,'Data','Win32','chunks0.toc'));
  const originalPatchToc=fs.readFileSync(path.join(game,'Patch','Win32','chunks0.toc'));
  const locateData=chunkLocator(originalToc),locatePatch=chunkLocator(originalPatchToc);
  for(const item of chosen)for(const row of item.rows){
    let p;try{p=locateData(row.chunkId);row.layer='Data';}catch{p=locatePatch(row.chunkId);row.layer='Patch';}
    row.tocOffset=p;
    const toc=row.layer==='Data'?originalToc:originalPatchToc;
    if(toc[p]!==0||toc[p+1]!==(row.layer==='Patch'?1:0)||toc[p+2]!==1)
      throw new Error('Unexpected original race intro location: '+row.assetName);}
  const additional=chosen.slice(1,10).concat(chosen.slice(11));
  if(additional.length!==19||additional.flatMap(x=>x.rows).length!==114)
    throw new Error('Incomplete race intro assignments');
  console.log('INTRO_ASSIGNMENTS',chosen.map(x=>x.context+' '+x.phrase+' <- '+path.basename(x.source)).join('\n'));
  if(process.argv.includes('--dry-run')){console.log('DRY_RUN_OK','10 day, 11 night, 126 segments');return;}
  const baseSlots={...config.slots,introDay:lists.day[0],introNight:lists.night[0]};
  // Base builder applies the same compensation: pass the unmodified markers.
  const baseConfig={slots:baseSlots,dropDaySeconds:Number(config.introDrops[lists.day[0]]),dropNightSeconds:Number(config.introDrops[lists.night[0]])};
  const configDir=path.join(root,'output','builder-configs');fs.mkdirSync(configDir,{recursive:true});
  const baseConfigFile=path.join(configDir,'intro-v2-base-'+Date.now()+'.json');
  fs.writeFileSync(baseConfigFile,JSON.stringify(baseConfig));
  const id='HeatMusic_'+new Date().toISOString().replace(/[-:T.Z]/g,'').slice(0,14)+'_'+crypto.randomBytes(3).toString('hex');
  const folder=createFreshBuildFolder(buildRoot,id);
  const reuseIndex=process.argv.indexOf('--reuse-prepared');
  if(reuseIndex>=0){
    const priorId=process.argv[reuseIndex+1];
    if(!/^HeatMusic_\d{14}_[0-9a-f]{6}$/.test(priorId||''))throw new Error('Invalid base ID');
    const prior=path.join(buildRoot,priorId);
    const old=JSON.parse(fs.readFileSync(path.join(prior,'manifest.json'),'utf8'));
    if(old.placements.length!==84||!old.playlists||
      old.slots.introDay!==baseSlots.introDay||old.slots.introNight!==baseSlots.introNight||
      old.slots.menu!==baseSlots.menu)
      throw new Error('Base package does not match the selected files');
    for(const key of ['freeDriveDay','freeDriveNight','raceDay','raceNight','garage']){
      const actual=fs.readdirSync(config.slots[key]).filter(x=>audioExtensions.has(path.extname(x).toLowerCase())).length;
      if(old.playlists[key].length!==actual)throw new Error('Base playlist changed: '+key);
    }
    for(const name of ['cas_08.cas','cas_13.cas','cas_14.cas','chunks0.toc','waves.tsv',
      'playlist-patch-chunks0.toc','playlist-patch.ealayer3','playlist-metadata.fbmod'])
      fs.copyFileSync(path.join(prior,name),path.join(folder,name));
    old.id=id;delete old.patchTocSha256;delete old.patchCasBytes;
    fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(old,null,2));
    fs.mkdirSync(path.join(folder,'normalized'));fs.mkdirSync(path.join(folder,'audio'));
    console.log('REUSED_PLAYLIST_BASE',priorId,'->',id);
  }else{
    console.log('PREPARING_PLAYLIST_BASE',id);
    await streamRun(process.execPath,[path.join(__dirname,'HeatMusicPlaylistBuilder.js'),baseConfigFile,'--resume',id,'--prepare-only'],7200000);
  }
  const manifestFile=path.join(folder,'manifest.json');
  const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
  if(manifest.placements.length!==84||!manifest.patchAudio)
    throw new Error('Base package does not have 84 Data placements + 1 Patch');
  const normalizedDir=path.join(folder,'normalized'),audioDir=path.join(folder,'audio');
  const normalized=new Map();let sourceIndex=0;
  for(const source of [...new Set(additional.map(x=>x.source))]){
    checkCancellation();
    normalized.set(source,normalize(source,normalizedDir,300+sourceIndex++));}
  // The first day and night race chunks were already encoded and validated
  // by HeatMusicBuilder. Reuse only when their manifest digest matches.
  for(const item of [chosen[0],chosen[groups.day.size]]){
    const row=item.rows[5],norm=normalized.get(item.source);
    if(!norm||config.slots[item.context==='day'?'introDay':'introNight']!==
      path.dirname(item.source))continue;
    const prior=manifest.placements.find(x=>x.name===row.assetName);
    if(!prior)continue;
    const prefix='intro-'+item.context+'-5-';
    const match=fs.readdirSync(audioDir).filter(x=>x.startsWith(prefix)&&x.endsWith('.ealayer3'))
      .map(x=>path.join(audioDir,x)).find(file=>
        fs.statSync(file).size===prior.audioBytes&&hashFile(file)===prior.audioSha256);
    if(!match)continue;
    const drop=dropFor(item.source),nominal=norm.duration-drop-0.1;
    encodedSegments.set(segmentKey(norm,true,drop,nominal),{
      file:match,bytes:prior.audioBytes,seconds:prior.seconds,
      sha256:prior.audioSha256,start:drop,requested:nominal});
    console.log('REUSED_BASE_RACE_AUDIO',item.context,path.basename(item.source));
  }
  const encodings=[];
  for(const item of additional){checkCancellation();
    const norm=normalized.get(item.source),drop=dropFor(item.source);
    for(const row of item.rows){const ea=encode(norm,row,audioDir,drop,item.rows.preRace);
      encodings.push({row,ea,source:item.source,drop});}
    console.log('ENCODED_INTRO_SEQUENCE',item.context,item.phrase,path.basename(item.source));}
  console.log('INTRO_CACHE_STATS',JSON.stringify(reuseStats));
  const toc=fs.readFileSync(path.join(folder,'chunks0.toc'));
  const casFile=path.join(folder,'cas_08.cas');let cursor=fs.statSync(casFile).size;
  const lines=[];manifest.patchExtras=[];
  for(const {row,ea,source,drop} of encodings){const p=row.tocOffset;
    if(row.layer==='Patch'){
      const raw=fs.readFileSync(ea.file);
      if(raw.length!==ea.bytes||sha(raw)!==ea.sha256)throw new Error('Patch audio changed: '+row.assetName);
      manifest.patchExtras.push({name:row.assetName,chunkId:row.chunkId,layer:'Patch',tocOffset:p,
        oldLocation:originalPatchToc.subarray(p,p+12).toString('hex'),
        audioFile:path.relative(folder,ea.file),audioBytes:ea.bytes,audioSha256:ea.sha256,
        seconds:ea.seconds,source,dropSeconds:drop});
      lines.push([row.assetName,ea.bytes,ea.seconds,path.relative(folder,ea.file).replace(/\\/g,'/')].join('\t'));
      continue;
    }
    if(!toc.subarray(p,p+12).equals(originalToc.subarray(p,p+12)))
      throw new Error('Original race intro location changed: '+row.assetName);
    const raw=fs.readFileSync(ea.file),wrapped=casWrap(raw);
    if(cursor+wrapped.length>0xffffffff)throw new Error('CAS exceeds the 32-bit limit');
    toc[p]=0;toc[p+1]=0;toc[p+2]=1;toc[p+3]=8;
    toc.writeUInt32BE(cursor,p+4);toc.writeUInt32BE(wrapped.length,p+8);
    fs.appendFileSync(casFile,wrapped);
    manifest.placements.push({name:row.assetName,chunkId:row.chunkId,layer:'Data',tocOffset:p,cas:8,
      newOffset:cursor,newSize:wrapped.length,audioBytes:ea.bytes,
      audioSha256:ea.sha256,seconds:ea.seconds,source,dropSeconds:drop});
    cursor+=wrapped.length;lines.push([row.assetName,ea.bytes,ea.seconds,path.relative(folder,ea.file).replace(/\\/g,'/')].join('\t'));}
  fs.writeFileSync(path.join(folder,'chunks0.toc'),toc);
  fs.appendFileSync(path.join(folder,'waves.tsv'),lines.join('\n')+'\n');
  manifest.casBytes[8]=cursor;manifest.tocSha256=sha(toc);
  manifest.introPlaylists={day:lists.day,night:lists.night};
  manifest.introAssignments=chosen.map(x=>({context:x.context,phrase:x.phrase,source:x.source,
    dropSeconds:dropFor(x.source),dropMarkerSeconds:Number(config.introDrops[x.source]),raceStartLeadSeconds:1}));
  for(const item of normalized.values())manifest.normalization.push({source:item.source,
    before:item.before,after:item.after,gainDb:item.gainDb});
  manifest.metadataFile='intro-playlist-metadata.fbmod';
  if(manifest.placements.length!==192||manifest.patchExtras.length!==6)
    throw new Error('Expected 192 Data and 7 Patch resources in total');
  fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2));
  require('./RunHeatMetadata').runMetadata(metadataBuilder,['dynamicallintro',path.join(folder,'waves.tsv'),
    path.join(folder,manifest.metadataFile)],{cwd:root});
  await streamRun(process.execPath,[path.join(__dirname,'VerifyPreparedHeatMusicIntroPlaylists.js'),folder],120000);
  console.log('PREPARED_INTRO_PLAYLIST',folder,'192 Data + 7 Patch audio resources embedded in FBMOD');
  if(process.argv.includes('--prepare-only'))return;
  checkCancellation();
  await streamRun(process.execPath,[path.join(__dirname,'ExportPreparedHeatMusic.js'),folder],120000);
}
if(require.main===module)main().catch(e=>{console.error('ERROR:',e.stack||e.message);process.exitCode=1;});
module.exports={encode,normalize};

// Local NFS Heat context-mod builder. Never writes to the game's Data/Patch folders.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const {checkCancellation}=require('./HeatMusicCancellation');
const normalizeUnsafe = require('./NormalizeUnsafeAudio');
const bitrateCandidates = require('./EaBitrateCandidates');
const {partialDuration,nextRequest} = require('./EaPartialDuration');
const paths=require('./HeatMusicPaths');
const {runMetadata}=require('./RunHeatMetadata');
const audioCache=require('./HeatMusicAudioCache');
const {inspectEa}=require('./HeatMusicEaLayer3');
const {encodeSegment,POLICY}=require('./HeatMusicEaEncoder');

const workspace = path.resolve(__dirname, '..');
const game = paths.game;
// This baseline is generated from the player's verified original files inside
// the portable workspace. Never depend on a legacy developer ModData folder.
const baseline = paths.baseline;
const ffmpeg = paths.ffmpeg;
const ffprobe = paths.ffprobe;
const converterDir = paths.converterDir;
const converter = paths.converter;
const metadataBuilder = path.resolve(__dirname, 'HeatTrack24SizeMod.exe');
const eaDecoder = path.resolve(__dirname, 'DecodeOriginalEaForLoudness.exe');
const configPath = process.argv[2] ? path.resolve(process.argv[2]) : null;
const prepareOnly = process.argv.includes('--prepare-only');
const resumeIndex = process.argv.indexOf('--resume');
const requiredSlots = ['freeDriveDay','freeDriveNight','raceDay','raceNight','garage','menu','introDay','introNight'];
const labels = {freeDriveDay:'Free roam day',freeDriveNight:'Free roam night',raceDay:'Race day',
  raceNight:'Race night',garage:'Garage',menu:'Menu',introDay:'Day race intro',introNight:'Night race intro'};
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const log = (...values) => console.log(...values);
function run(executable,args,timeout=180000,options={}) {
  checkCancellation();
  const result = spawnSync(executable,args,{encoding:'utf8',timeout,windowsHide:true,
    maxBuffer:4*1024*1024,...options});
  if (result.status !== 0) throw new Error('Command failed: '+path.basename(executable)+' '+
    String(result.error||result.stderr||result.stdout).slice(-1500));
  checkCancellation();
  return result;
}
function probeDuration(file) {
  return audioCache.memo('duration',file,{},()=>({seconds:probeDurationUncached(file)})).seconds;
}
function probeDurationUncached(file) {
  const output = run(ffprobe,['-v','error','-show_entries','format=duration','-of','json',file],20000);
  const seconds = Number(JSON.parse(output.stdout).format.duration);
  if (!Number.isFinite(seconds) || seconds < 20) throw new Error('Invalid audio duration (at least 20 s required): '+file);
  return seconds;
}
function measure(file) {
  return audioCache.memo('loudness',file,{},()=>measureUncached(file));
}
function measureUncached(file) {
  const output = run(ffmpeg,['-hide_banner','-nostats','-i',file,
    '-af','loudnorm=I=-18:TP=-1:LRA=11:print_format=json','-f','null','NUL'],120000);
  const match = output.stderr.match(/\{\s*"input_i"[\s\S]*?\}/);
  if (!match) throw new Error('Could not measure loudness: '+file);
  const data = JSON.parse(match[0]);
  return {lufs:Number(data.input_i),truePeak:Number(data.input_tp)};
}
function trailingSilenceStart(file,duration){
  return audioCache.memo('base-silence',file,{duration},()=>({value:trailingSilenceUncached(file,duration)})).value;
}
function trailingSilenceUncached(file,duration){
  const output=run(ffmpeg,['-hide_banner','-nostats','-i',file,
    '-af','silencedetect=noise=-60dB:d=0.5','-f','null','NUL'],120000);
  const starts=[...output.stderr.matchAll(/silence_start:\s*([\d.]+)/g)];
  const ends=[...output.stderr.matchAll(/silence_end:\s*([\d.]+)/g)];
  if(!starts.length||!ends.length)return null;
  const start=Number(starts.at(-1)[1]),end=Number(ends.at(-1)[1]);
  return Math.abs(end-duration)<0.2&&duration-start>=1&&duration-start<=30?start:null;
}
function encodeEa(normalized,folder,label,params) {
  return audioCache.memo('base-segment',normalized,{...params,eaPolicy:POLICY},
    ()=>encodeEaUncached(normalized,folder,label,params),path.join(folder,label+'-cached.ealayer3'),
    r=>inspectEa(r.file,r.seconds,0.01));
}
function encodeEaUncached(normalized,folder,label,params) {
  return encodeSegment(normalized,folder,label,params);
}
function casWrap(raw) {
  const parts=[];
  for(let p=0;p<raw.length;) {
    const n=Math.min(65536,raw.length-p), block=Buffer.allocUnsafe(n+8);
    block.writeUInt32BE(n,0); block.writeUInt16BE(n===65536?0x71:0x70,4);
    block.writeUInt16BE(n===65536?0:n,6); raw.copy(block,8,p,p+n);
    parts.push(block); p+=n;
  }
  return Buffer.concat(parts);
}

function main(){
checkCancellation();
if(!configPath || !fs.existsSync(configPath)) throw new Error('Configuration JSON required');
const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
if(!config.slots || requiredSlots.some(slot=>typeof config.slots[slot]!=='string' || !fs.existsSync(config.slots[slot])))
  throw new Error('All eight source files must exist');
for(const field of ['dropDaySeconds','dropNightSeconds'])
  if(!Number.isFinite(config[field]) || config[field]<10 || config[field]>600) throw new Error('Invalid '+field);
for(const file of [ffmpeg,ffprobe,converter,metadataBuilder,eaDecoder,
  path.join(baseline,'Data','Win32','chunks0.toc')])
  if(!fs.existsSync(file)) throw new Error('Required local tool or tested baseline missing: '+file);
const buildId=resumeIndex>=0 ? path.basename(process.argv[resumeIndex+1]) :
  'HeatMusic_'+new Date().toISOString().replace(/[-:T.Z]/g,'').slice(0,14)+'_'+crypto.randomBytes(3).toString('hex');
if(!/^HeatMusic_[A-Za-z0-9_]{10,40}$/.test(buildId)) throw new Error('Invalid build ID');
const folder=path.resolve(workspace,'output','custom-builds',buildId);
if(resumeIndex>=0 && !fs.existsSync(folder)) throw new Error('Resume folder missing');
fs.mkdirSync(folder,{recursive:true});
log('BUILD',buildId,'PREPARE_ONLY',prepareOnly);
const normalizedFolder=path.join(folder,'normalized');
const audioFolder=path.join(folder,'audio');
fs.mkdirSync(normalizedFolder,{recursive:true}); fs.mkdirSync(audioFolder,{recursive:true});
const normalized=new Map();
const normalizedByHash=new Map();
for(const slot of requiredSlots) {
  const source=path.resolve(config.slots[slot]);
  if(normalized.has(source)) continue;
  const contentHash=sha(fs.readFileSync(source));
  if(normalizedByHash.has(contentHash)){
    normalized.set(source,normalizedByHash.get(contentHash));
    log('REUSED_NORMALIZED',labels[slot],path.basename(source));
    continue;
  }
  const item=audioCache.memo('normalized',source,{},()=>{
  const duration=probeDuration(source), before=measure(source);
  if(!Number.isFinite(before.lufs)) throw new Error('No loudness measurement: '+source);
  // The proven MP3 -> EA Layer3 -> game PCM path measures about 0.35 LU quieter.
  // Compensate upstream, then verify the actual encoded result before installation.
  const gain=-18-before.lufs+0.35;
  if(!Number.isFinite(before.truePeak)) throw new Error('True peak could not be measured: '+source);
  const unsafeGain=before.truePeak+gain>-1;
  const wav=path.join(normalizedFolder,'song-'+normalized.size+'.wav');
  if(!fs.existsSync(wav)) {
    if(unsafeGain)normalizeUnsafe(source,wav,ffmpeg);
    else run(ffmpeg,['-hide_banner','-loglevel','error','-i',source,'-map','0:a:0',
      '-af','volume='+gain.toFixed(3)+'dB','-ar','48000','-ac','2','-c:a','pcm_s16le',wav],120000);
  }
  const after=measure(wav);
  if(Math.abs(after.lufs+17.65)>(unsafeGain?0.35:0.25)) throw new Error('Pre-encode normalization outside tolerance: '+source+' '+after.lufs);
  if(after.truePeak>-0.9) throw new Error('Normalized WAV has an unsafe true peak: '+source);
  const result={wav,duration,gain:unsafeGain?null:gain,gainDb:unsafeGain?null:gain,before,after,
    method:unsafeGain?'dynamic-compressor':'gain'};
  log('NORMALIZED',path.basename(source),before.lufs,'->',after.lufs,'LUFS',
    unsafeGain?'dynamic compressor':'gain '+gain.toFixed(2)+' dB');
  return result;
  },path.join(normalizedFolder,'song-'+normalized.size+'.wav'));
  item.duration=probeDuration(item.wav);
  normalized.set(source,item);normalizedByHash.set(contentHash,item);
}

const slotAudio={};
const fullSongEncodes=new Map();
for(const slot of requiredSlots.slice(0,5)) {
  const item=normalized.get(path.resolve(config.slots[slot]));
  // The decoded PCM duration, not container timestamps, defines the full song.
  const seconds=item.duration;
  const encodeKey=JSON.stringify([item.wav,seconds]);
  const previous=fullSongEncodes.get(encodeKey);
  if(previous){
    slotAudio[slot]=previous.ea;
    log('REUSED_ENCODED',labels[slot],'from',labels[previous.slot]);
  }else{
    slotAudio[slot]=encodeEa(item.wav,audioFolder,slot,{seconds,allowTrim:true});
    fullSongEncodes.set(encodeKey,{ea:slotAudio[slot],slot});
  }
  const tailCut=item.duration-slotAudio[slot].seconds;
  if(tailCut>2){
    const silenceStart=trailingSilenceStart(item.wav,item.duration);
    if(silenceStart===null||silenceStart-slotAudio[slot].seconds>2)
      throw new Error('The converter would cut more than 2 audible seconds from '+labels[slot]+
        '; choose a shorter song or edit it before building');
    log('WARNING',labels[slot],'trailing silence omitted',tailCut.toFixed(2)+'s');
  }
  log('ENCODED',labels[slot],slotAudio[slot].seconds,'seconds');
}
const menuSource=path.resolve(config.slots.menu);
const menu=normalized.get(menuSource);
if(!Number.isFinite(menu.duration)||menu.duration<12)throw new Error('Menu song must have at least 12 seconds');
slotAudio.menuLead=encodeEa(menu.wav,audioFolder,'menuLead',{seconds:11.0});
// Continue at the actual encoded lead boundary; never reuse the whole garage song.
const menuLoopStart=slotAudio.menuLead.seconds;
const menuLoopSeconds=menu.duration-menuLoopStart-0.25;
slotAudio.menuLoop=encodeEa(menu.wav,audioFolder,'menuLoopAfterLead',{
  start:menuLoopStart,seconds:menuLoopSeconds,allowTrim:true});
const menuAudibleEnd=trailingSilenceStart(menu.wav,menu.duration)??menu.duration;
if(menuAudibleEnd-(menuLoopStart+slotAudio.menuLoop.seconds)>2)
  throw new Error('Menu loop would lose more than 2 audible seconds');
log('MENU_SEQUENCE','lead 0 ->',menuLoopStart,'loop',menuLoopStart,'->',menuLoopStart+slotAudio.menuLoop.seconds);
const introRows=fs.readFileSync(path.resolve(workspace,'output','race-intro-track24-test','waves.tsv'),'utf8')
  .trim().split(/\r?\n/).map(line=>{const [name,oldSeconds]=line.split('\t');return{name,oldSeconds:Number(oldSeconds)};});
if(introRows.length!==12) throw new Error('Original intro segment inventory missing');
const introOrder=[...introRows.slice(0,5).map((r,i)=>({row:r,context:'day',i})),
  ...introRows.slice(5,10).map((r,i)=>({row:r,context:'night',i})),
  {row:introRows[10],context:'day',i:5},{row:introRows[11],context:'night',i:5}];
const introCursors={};
for(const context of ['day','night']) {
  const rows=introOrder.filter(x=>x.context===context&&x.i<5);
  const pre=rows.reduce((n,x)=>n+x.row.oldSeconds,0);
  const drop=require('./HeatMusicTiming').raceStart(config[context==='day'?'dropDaySeconds':'dropNightSeconds']);
  const song=normalized.get(path.resolve(config.slots[context==='day'?'introDay':'introNight']));
  if(drop<=pre+0.1 || drop>=song.duration-1) throw new Error('Drop point invalid for '+context);
  introCursors[context]=drop-pre;
}
const introAudio=[];
const introEncodes=new Map();
for(const item of introOrder) {
  const context=item.context, song=normalized.get(path.resolve(config.slots[context==='day'?'introDay':'introNight']));
  const drop=require('./HeatMusicTiming').raceStart(config[context==='day'?'dropDaySeconds':'dropNightSeconds']);
  const race=item.i===5, start=race?drop:introCursors[context];
  // The race segment must end with the selected song, not at the original
  // game's song length. The preceding five segments already play its intro.
  const seconds=race?song.duration-drop-0.1:item.row.oldSeconds;
  const introKey=JSON.stringify([song.wav,start,seconds,race]);
  const prior=introEncodes.get(introKey);
  const ea=prior?prior.ea:encodeEa(song.wav,audioFolder,'intro-'+context+'-'+item.i,
    {start,seconds,allowTrim:race,maxTrims:race?16:3});
  if(prior)log('REUSED_ENCODED_INTRO',context,item.i,'from',prior.context,prior.i);
  else introEncodes.set(introKey,{ea,context,i:item.i});
  if(race){
    const audibleEnd=trailingSilenceStart(song.wav,song.duration)??song.duration;
    const audibleLoss=Math.max(0,audibleEnd-(drop+ea.seconds));
    if(audibleLoss>1.25)
      throw new Error('Race intro '+context+' would lose '+audibleLoss.toFixed(2)+
        ' audible seconds at the end of the track');
    log('RACE_SONG_END',context,'drop',drop,'audio',ea.seconds,
      'source',song.duration,'audible loss',audibleLoss.toFixed(2));
  }
  introAudio.push(ea);
  if(!race) introCursors[context]+=item.row.oldSeconds;
  log('ENCODED','Race intro',context,item.i,ea.seconds,'seconds');
}
for(const context of ['day','night']) {
  const drop=require('./HeatMusicTiming').raceStart(config[context==='day'?'dropDaySeconds':'dropNightSeconds']);
  if(Math.abs(introCursors[context]-drop)>0.01) throw new Error('Drop alignment mismatch '+context);
}
const encodedMeasurements={};
const measurementsByAudio=new Map();
for(const slot of [...requiredSlots.slice(0,5),'menuLoop']) {
  const ea=slotAudio[slot];
  let measured=measurementsByAudio.get(ea.file);
  if(measured){
    log('REUSED_FINAL_LOUDNESS',slot);
  }else{
    measured=audioCache.memo('decoded-loudness',ea.file,{},()=>{
      const wav=path.join(folder,'verify-'+slot+'.wav');
      run(eaDecoder,[ea.file,wav],120000);return measure(wav);
    });
    measurementsByAudio.set(ea.file,measured);
  }
  encodedMeasurements[slot]=measured;
  log('FINAL_LOUDNESS',slot,measured.lufs,'LUFS',measured.truePeak,'dBTP');
  // A loop is an excerpt of the normalized song; its integrated LUFS may differ
  // from the full track. Do not alter its gain independently at the transition.
  if(slot!=='menuLoop'&&Math.abs(measured.lufs+18)>0.3)
    throw new Error('Encoded song not near -18 LUFS: '+slot+' '+measured.lufs);
}

const five=JSON.parse(fs.readFileSync(path.resolve(workspace,'output','direct-track24-ealayer3-all-test','manifest.json'))).placements;
const introBase=JSON.parse(fs.readFileSync(path.resolve(workspace,'output','direct-track24-race-intro-test','manifest.json')));
const menuLoopBase=JSON.parse(fs.readFileSync(path.resolve(workspace,'output','direct-track24-menu-loop-test','manifest.json')));
const menuLeadBase=JSON.parse(fs.readFileSync(path.resolve(workspace,'output','direct-track24-menu-lead-loop-test','manifest.json')));
const sourceData=path.join(baseline,'Data');
const sourceToc=path.join(sourceData,'Win32','chunks0.toc');
const sourceCas={8:path.join(sourceData,'Win32','configurations','superbundleinstallpackage2','cas_08.cas'),
  13:path.join(sourceData,'Win32','configurations','superbundleinstallpackage','cas_13.cas'),
  14:path.join(sourceData,'Win32','configurations','superbundleinstallpackage','cas_14.cas')};
const baselineToc=fs.readFileSync(sourceToc);
if(sha(baselineToc)!==introBase.patchedTocSha256 ||
   fs.statSync(sourceCas[8]).size!==introBase.finalCas08Bytes ||
   fs.statSync(sourceCas[13]).size!==menuLeadBase.cas13Bytes ||
   fs.statSync(sourceCas[14]).size!==menuLoopBase.cas14Bytes)
  throw new Error('Tested audio baseline changed; cannot build safely');
const placements=[];
const fiveKeys=requiredSlots.slice(0,5);
for(let i=0;i<5;i++) placements.push({name:[
  'Audio/Music/Roboto/Playlist/DC_FelixJaehnBreakingBeattz_LIITA',
  'Audio/Music/Roboto/Playlist/NC_Logic_Mama_ShowLoveftYBNCordae',
  'Audio/Music/Roboto/Playlist/DI_TheTribeOfGood_TurningUpForTheSunshine(Remix)',
  'Audio/Music/Roboto/Playlist/NI_MNKYBSNSS_OtroLugar',
  'Audio/Music/Roboto/Playlist/GA_KingsOfTheRollers_GuitarTrack'][i],
  tocOffset:five[i].tocOffset,cas:8,oldOffset:five[i].newOffset,oldSize:five[i].newSize,
  ea:slotAudio[fiveKeys[i]]});
function loc(hex) { const bytes=Buffer.from(hex,'hex');
  if(bytes.length!==12 || bytes[0]!==0 || bytes[1]!==0 || bytes[2]!==0) throw new Error('Bad menu TOC location');
  return {cas:bytes[3],offset:bytes.readUInt32BE(4),size:bytes.readUInt32BE(8)}; }
const loopLoc=loc(menuLoopBase.newLocation),leadLoc=loc(menuLeadBase.newLocation);
placements.push({name:'Audio/Music/Roboto/LoadingScreen_Music/Roboto_Bootflow_Loop_Underground',
  tocOffset:menuLoopBase.tocOffset,cas:14,oldOffset:loopLoc.offset,oldSize:loopLoc.size,ea:slotAudio.menuLoop});
placements.push({name:'Audio/Music/Roboto/LoadingScreen_Music/Roboto_Bootflow_LeadIn_Underground',
  tocOffset:menuLeadBase.tocOffset,cas:13,oldOffset:leadLoc.offset,oldSize:leadLoc.size,ea:slotAudio.menuLead});
for(let i=0;i<12;i++) placements.push({name:introBase.placements[i].assetName,
  tocOffset:introBase.placements[i].tocOffset,cas:8,
  oldOffset:introBase.placements[i].newOffset,oldSize:introBase.placements[i].newSize,
  ea:introAudio[i]});
if(placements.length!==19 || placements[5].cas!==14 || placements[6].cas!==13)
  throw new Error('Expected nineteen audio placements');
const toc=Buffer.from(baselineToc), cursors={},casOutputs={};
for(const casNumber of [8,13,14]) {
  const output=path.join(folder,'cas_'+String(casNumber).padStart(2,'0')+'.cas');
  if(!fs.existsSync(output)) fs.copyFileSync(sourceCas[casNumber],output,fs.constants.COPYFILE_EXCL);
  else if(resumeIndex>=0 && !fs.existsSync(path.join(folder,'manifest.json')))
    fs.copyFileSync(sourceCas[casNumber],output);
  else throw new Error('Generated CAS already exists: '+output);
  cursors[casNumber]=fs.statSync(output).size;
  casOutputs[casNumber]=output;
}
for(const item of placements) {
  const p=item.tocOffset;
  if(toc[p]!==0 || toc[p+1]!==0 || toc[p+2]!==((item.cas===13||item.cas===14)?0:1) || toc[p+3]!==item.cas ||
      toc.readUInt32BE(p+4)!==item.oldOffset || toc.readUInt32BE(p+8)!==item.oldSize)
    throw new Error('Baseline TOC mismatch: '+item.name+' expected='+
      [item.cas,item.oldOffset,item.oldSize].join('/')+' actual='+
      [toc[p],toc[p+1],toc[p+2],toc[p+3],toc.readUInt32BE(p+4),toc.readUInt32BE(p+8)].join('/'));
  const raw=fs.readFileSync(item.ea.file),wrapped=casWrap(raw);
  if(cursors[item.cas]+wrapped.length>0xffffffff)throw new Error('Generated CAS exceeds the 32-bit offset limit; use a smaller playlist');
  item.newOffset=cursors[item.cas]; item.newSize=wrapped.length;
  fs.appendFileSync(casOutputs[item.cas],wrapped);
  cursors[item.cas]+=wrapped.length;
  toc.writeUInt32BE(item.newOffset,p+4); toc.writeUInt32BE(item.newSize,p+8);
  log('PATCHED',item.name,item.ea.seconds,'seconds');
}
const generatedToc=path.join(folder,'chunks0.toc');
fs.writeFileSync(generatedToc,toc,{flag:'wx'});
for(const casNumber of [8,13,14])
  if(fs.statSync(casOutputs[casNumber]).size!==cursors[casNumber]) throw new Error('CAS size mismatch '+casNumber);
const waves=path.join(folder,'waves.tsv');
fs.writeFileSync(waves,placements.map(item=>[item.name,item.ea.bytes,item.ea.seconds,
  path.relative(folder,item.ea.file).replace(/\\/g,'/')].join('\t')).join('\n')+'\n',{flag:'wx'});
const manifest={id:buildId,slots:config.slots,actualMenuSource:menuSource,
  menuSegments:{mode:'intro-once-loop-remainder',leadSeconds:slotAudio.menuLead.seconds,
    loopStartSeconds:menuLoopStart,loopSeconds:slotAudio.menuLoop.seconds},
  dropDaySeconds:config.dropDaySeconds,
  dropNightSeconds:config.dropNightSeconds,normalization:[...normalized].map(([source,item])=>({source,
    wav:item.wav,duration:item.duration,before:item.before,after:item.after,
    gainDb:item.gain,method:item.method})),
  encodedMeasurements,tocSha256:sha(toc),casBytes:cursors,placements:placements.map(item=>({name:item.name,
    tocOffset:item.tocOffset,cas:item.cas,newOffset:item.newOffset,newSize:item.newSize,
    audioBytes:item.ea.bytes,audioSha256:item.ea.sha256,seconds:item.ea.seconds}))};
fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});
const metadata=path.join(folder,'metadata.fbmod');
runMetadata(metadataBuilder,['dynamic',waves,metadata],{cwd:workspace});
if(!fs.existsSync(metadata)) throw new Error('Metadata fbmod not produced');
log('METADATA',metadata);
if(prepareOnly) {log('PREPARED',folder);process.exit(0);}
const installResult=run(process.execPath,[path.resolve(__dirname,'InstallPreparedHeatMusic.js'),folder],
  240000,{cwd:workspace});
process.stdout.write(installResult.stdout);
}
if(require.main===module)main();
module.exports={encodeEa};

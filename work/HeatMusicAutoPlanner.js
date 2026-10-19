// One-folder V3 planner. Creates an isolated V2-compatible configuration.
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {spawnSync,spawn}=require('child_process');
const {checkCancellation}=require('./HeatMusicCancellation');
const paths=require('./HeatMusicPaths');
const root=path.resolve(__dirname,'..');
const ffmpeg=paths.ffmpeg;
const ffprobe=paths.ffprobe;
const extensions=new Set(['.wav','.mp3','.flac','.m4a']);
const capacities={garage:12,freeDriveDay:10,freeDriveNight:16,raceDay:10,raceNight:11};
const keys=['garage','freeDriveDay','freeDriveNight','raceDay','raceNight'];
const sourceDir=process.argv[2]?path.resolve(process.argv[2]):'';
const planOnly=process.argv.includes('--plan-only');
const prepareOnly=process.argv.includes('--prepare-only');
const stageOnly=process.argv.includes('--stage-only');
const editPlan=process.argv.includes('--edit-plan');
const usePlanAt=process.argv.indexOf('--use-plan');
const validateEditorAt=process.argv.indexOf('--validate-editor');
function run(exe,args,timeout,maxBuffer=8*1024*1024){
  checkCancellation();
  const p=spawnSync(exe,args,{encoding:null,timeout,maxBuffer,windowsHide:true});
  if(p.status!==0)throw new Error(path.basename(exe)+' failed: '+String(p.error||p.stderr||p.stdout).slice(-600));
  checkCancellation();
  return p;
}
function streamRun(exe,args,timeout){return new Promise((resolve,reject)=>{
  try{checkCancellation();}catch(error){reject(error);return;}
  const child=spawn(exe,args,{cwd:root,stdio:'inherit',windowsHide:true});
  const timer=setTimeout(()=>child.kill(),timeout);
  child.on('error',e=>{clearTimeout(timer);reject(e);});
  child.on('exit',code=>{clearTimeout(timer);
    if(code!==0){checkCancellation();reject(new Error(path.basename(exe)+' exited with '+code));return;}
    try{checkCancellation();resolve();}catch(error){reject(error);}
  });
});}
function duration(file){
  const p=run(ffprobe,['-v','error','-show_entries','format=duration','-of','json',file],30000);
  const seconds=Number(JSON.parse(p.stdout.toString('utf8')).format.duration);
  if(!Number.isFinite(seconds)||seconds<20)
    throw new Error('Track must have a valid duration of at least 20 seconds: '+file);
  return seconds;
}
function audioAnalysis(file,seconds){
  const analysisSeconds=Math.min(seconds,150);
  const p=run(ffmpeg,['-hide_banner','-loglevel','error','-i',file,'-t',analysisSeconds.toFixed(3),
    '-map','0:a:0','-ac','1','-ar','4000','-f','s16le','pipe:1'],180000,4*1024*1024);
  const pcm=p.stdout,windowSamples=2000;
  if(pcm.length<windowSamples*2*40)throw new Error('Could not analyze audio: '+file);
  const count=Math.floor(pcm.length/(windowSamples*2)),energy=[];
  for(let i=0;i<count;i++){
    let sum=0;const start=i*windowSamples*2;
    for(let j=0;j<windowSamples;j++){const sample=pcm.readInt16LE(start+j*2)/32768;sum+=sample*sample;}
    energy.push(Math.max(-90,20*Math.log10(Math.sqrt(sum/windowSamples)+1e-8)));
  }
  const active=energy.slice(0,Math.min(energy.length,240)).filter(x=>x>-60);
  if(active.length<20)throw new Error('Audio is almost silent: '+file);
  const sorted=[...active].sort((a,b)=>a-b),percent=q=>sorted[Math.floor((sorted.length-1)*q)];
  const mean=active.reduce((a,b)=>a+b,0)/active.length;
  const pulse=active.slice(1).reduce((sum,x,i)=>sum+Math.abs(x-active[i]),0)/(active.length-1);
  const activity=mean+0.25*(percent(0.8)-percent(0.2))+0.7*pulse;
  const avg=(from,to)=>{let total=0,n=0;
    for(let i=Math.max(0,from);i<Math.min(to,energy.length);i++){total+=energy[i];n++;}
    return n?total/n:-90;};
  const start=40,stop=Math.min(energy.length-8,Math.floor((seconds-8)*2));
  let best={index:-1,score:-Infinity,rise:0};
  for(let i=start;i<stop;i++){
    const before=avg(i-8,i-1),after=avg(i+1,i+5);
    const rise=after-before;
    const sustained=avg(i+4,i+9);
    const score=rise*2+0.16*after+0.10*sustained;
    if(after>-37&&sustained>-39&&score>best.score)best={index:i,score,rise};
  }
  const fallback=Math.min(seconds-8,Math.max(20,Math.min(90,seconds*0.3)));
  const drop=best.index>=0&&best.rise>=2.5?best.index/2:fallback;
  return{activity:Number(activity.toFixed(3)),dropSeconds:Number(drop.toFixed(1)),
    dropRiseDb:Number(best.rise.toFixed(2)),dropMethod:best.index>=0&&best.rise>=2.5?'onset':'fallback'};
}
function quotas(n){
  if(n<5)return Object.fromEntries(keys.map(key=>[key,1]));
  const result=Object.fromEntries(keys.map(key=>[key,1]));
  for(let i=5;i<Math.min(n,59);i++){
    const candidate=keys.filter(key=>result[key]<capacities[key])
      .sort((a,b)=>result[a]/capacities[a]-result[b]/capacities[b]||keys.indexOf(a)-keys.indexOf(b))[0];
    result[candidate]++;
  }
  return result;
}
function allocate(tracks){
  const sorted=[...tracks].sort((a,b)=>a.activity-b.activity||a.file.localeCompare(b.file));
  let selected=sorted,skipped=[];
  if(sorted.length>59){
    selected=Array.from({length:59},(_,i)=>sorted[Math.round(i*(sorted.length-1)/58)]);
    const selectedPaths=new Set(selected.map(x=>x.file));skipped=sorted.filter(x=>!selectedPaths.has(x.file));
  }
  const quota=quotas(selected.length);
  const raceEligible=selected.filter(x=>x.duration>=30);
  if(!raceEligible.length)throw new Error('Race intros need at least one track that is 30 s or longer');
  const pools={garage:[],freeDriveDay:[],freeDriveNight:[],raceDay:[],raceNight:[]};
  const remaining=[...selected];
  const takeRace=(key)=>{
    while(pools[key].length<quota[key]){
      const eligible=remaining.filter(x=>x.duration>=30);
      if(!eligible.length)break;
      const item=eligible[eligible.length-1];pools[key].push(item);
      remaining.splice(remaining.indexOf(item),1);
    }
    for(let i=0;pools[key].length<quota[key];i++)pools[key].push(raceEligible[raceEligible.length-1-i%raceEligible.length]);
  };
  takeRace('raceNight');takeRace('raceDay');
  for(const key of ['garage','freeDriveDay','freeDriveNight']){
    while(pools[key].length<quota[key]&&remaining.length)pools[key].push(remaining.shift());
    for(let i=0;pools[key].length<quota[key];i++)pools[key].push(selected[i%selected.length]);
  }
  const menuIndex=pools.garage.findIndex(x=>Number.isFinite(x.duration)&&x.duration>12);
  if(menuIndex<0)throw new Error('No garage track is suitable for the menu (more than 12 s required)');
  const menu=pools.garage.splice(menuIndex,1)[0];
  pools.garage.unshift(menu);
  return{pools,skipped,quota,menu};
}
function stage(planDir,allocated){
  const slots={};
  const makeDir=name=>{const dir=path.join(planDir,name);fs.mkdirSync(dir);return dir;};
  // These are links to our own staging copies, never to the user's originals.
  const link=(source,dest)=>{try{fs.linkSync(source,dest);}catch(error){
    if(error.code!=='EXDEV'&&error.code!=='EPERM')throw error;
    fs.copyFileSync(source,dest,fs.constants.COPYFILE_EXCL);
  }};
  for(const key of keys){const dir=makeDir(key);slots[key]=dir;
    allocated.pools[key].forEach((item,i)=>link(item.stagedSource,
      path.join(dir,String(i+1).padStart(2,'0')+path.extname(item.stagedSource))));
  }
  slots.menu=path.join(planDir,'menu'+path.extname(allocated.menu.stagedSource));
  link(allocated.menu.stagedSource,slots.menu);
  const drops={};
  for(const [introKey,raceKey] of [['introDay','raceDay'],['introNight','raceNight']]){
    const dir=makeDir(introKey);slots[introKey]=dir;
    allocated.pools[raceKey].forEach((item,i)=>{
      const dest=path.join(dir,String(i+1).padStart(2,'0')+path.extname(item.stagedSource));
      link(item.stagedSource,dest);drops[dest]=item.dropSeconds;
    });
  }
  return{slots,introDrops:drops};
}
function editedAllocation(editorFile){
  const plansRoot=path.resolve(root,'output','auto-plans');
  const editorPath=path.resolve(editorFile||'');
  const planDir=path.dirname(editorPath);
  if(path.dirname(planDir)!==plansRoot||path.basename(editorPath)!=='editor.json')
    throw new Error('Edited plan is outside the allowed folder');
  const report=JSON.parse(fs.readFileSync(path.join(planDir,'report.json'),'utf8'));
  const editor=JSON.parse(fs.readFileSync(editorPath,'utf8'));
  if(editor.version!==1||path.resolve(report.sourceDir)!==sourceDir||
    !Array.isArray(report.tracks)||!report.tracks.length||!editor.playlists||
    !Array.isArray(editor.drops))throw new Error('Edited plan does not match the folder');
  const tracks=report.tracks.map((item,i)=>{
    const expected=path.join(planDir,'sources',String(i+1).padStart(3,'0')+
      path.extname(item.file).toLowerCase());
    if(path.resolve(item.stagedSource)!==expected||!fs.existsSync(expected))
      throw new Error('Prepared source is missing or changed: '+i);
    const drop=Number(editor.drops[i]);
    if(!Number.isFinite(drop)||drop<16.2||drop>Math.min(150,item.duration-8))
      throw new Error('Drop out of range for '+path.basename(item.file));
    return {...item,dropSeconds:drop};
  });
  if(editor.drops.length!==tracks.length)throw new Error('Incomplete drop list');
  const pools={};
  for(const key of keys){
    const ids=editor.playlists[key];
    if(!Array.isArray(ids)||!ids.length||ids.length>capacities[key]||
      new Set(ids).size!==ids.length)throw new Error('Invalid playlist: '+key);
    pools[key]=ids.map(id=>{
      if(!Number.isInteger(id)||id<0||id>=tracks.length)
        throw new Error('Unknown track in '+key);
      if((key==='raceDay'||key==='raceNight')&&tracks[id].duration<30)
        throw new Error('Track is too short for racing: '+path.basename(tracks[id].file));
      return tracks[id];
    });
  }
  if(!Number.isInteger(editor.menu)||editor.menu<0||editor.menu>=tracks.length||
    !Number.isFinite(tracks[editor.menu].duration)||tracks[editor.menu].duration<=12)
    throw new Error('Invalid menu track (must be longer than 12 s)');
  const used=new Set([editor.menu,...keys.flatMap(key=>editor.playlists[key])]);
  return {pools,menu:tracks[editor.menu],quota:Object.fromEntries(keys.map(key=>[key,pools[key].length])),
    skipped:tracks.filter((item,i)=>!used.has(i)),sourceTrackCount:tracks.length};
}
async function main(){
  checkCancellation();
  if(!sourceDir||!fs.existsSync(sourceDir)||!fs.statSync(sourceDir).isDirectory())
    throw new Error('Select a valid music folder');
  for(const tool of [ffmpeg,ffprobe])if(!fs.existsSync(tool))throw new Error('Missing tool: '+tool);
  if(usePlanAt>=0||validateEditorAt>=0){
    const at=usePlanAt>=0?usePlanAt:validateEditorAt;
    const allocated=editedAllocation(process.argv[at+1]);
    // Imported caches stay isolated under the validated plan, never execute code.
    const importedCache=path.join(path.dirname(path.resolve(process.argv[at+1])),'audio-cache');
    if(fs.existsSync(importedCache))process.env.HEAT_MUSIC_PRESET_CACHE=importedCache;
    else delete process.env.HEAT_MUSIC_PRESET_CACHE;
    console.log('EDITOR_VALIDATED',Object.fromEntries(keys.map(key=>[key,allocated.pools[key].length])));
    if(validateEditorAt>=0)return;
    const id='HeatAuto_'+new Date().toISOString().replace(/[-:T.Z]/g,'').slice(0,14)+'_'+crypto.randomBytes(3).toString('hex');
    const planDir=path.join(root,'output','auto-plans',id);fs.mkdirSync(planDir,{recursive:true});
    const config=stage(planDir,allocated);
    const configFile=path.join(planDir,'config.json');fs.writeFileSync(configFile,JSON.stringify(config,null,2));
    if(stageOnly){console.log('EDITOR_STAGE_READY',configFile);return;}
    const builder=path.join(__dirname,'HeatMusicIntroPlaylistBuilder.js');
    await streamRun(process.execPath,[builder,configFile,...(prepareOnly?['--prepare-only']:[])],9000000);
    return;
  }
  const files=fs.readdirSync(sourceDir,{withFileTypes:true})
    .filter(x=>x.isFile()&&extensions.has(path.extname(x.name).toLowerCase()))
    .map(x=>path.join(sourceDir,x.name)).sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true}));
  if(!files.length)throw new Error('The folder contains no WAV, MP3, FLAC or M4A files');
  const id='HeatAuto_'+new Date().toISOString().replace(/[-:T.Z]/g,'').slice(0,14)+'_'+crypto.randomBytes(3).toString('hex');
  const planDir=path.join(root,'output','auto-plans',id);fs.mkdirSync(planDir,{recursive:true});
  const safeSources=path.join(planDir,'sources');fs.mkdirSync(safeSources);
  const tracks=[];
  for(let i=0;i<files.length;i++){
    checkCancellation();
    const file=files[i],stagedSource=path.join(safeSources,
      String(i+1).padStart(3,'0')+path.extname(file).toLowerCase());
    fs.copyFileSync(file,stagedSource,fs.constants.COPYFILE_EXCL);
    const seconds=duration(stagedSource),info=audioAnalysis(stagedSource,seconds);
    tracks.push({file,stagedSource,duration:Number(seconds.toFixed(3)),...info});
    console.log('ANALYZED',i+1+'/'+files.length,path.basename(file),'energy',info.activity,
      'drop',info.dropSeconds+'s',info.dropMethod,'rise',info.dropRiseDb+'dB');
  }
  const allocated=allocate(tracks);
  const config=stage(planDir,allocated);
  const configFile=path.join(planDir,'config.json');fs.writeFileSync(configFile,JSON.stringify(config,null,2));
  const report={sourceDir,tracks,capacities,quota:allocated.quota,
    assignments:Object.fromEntries(keys.map(k=>[k,allocated.pools[k].map(x=>x.file)])),
    introDay:allocated.pools.raceDay.map(x=>({source:x.file,dropSeconds:x.dropSeconds,method:x.dropMethod})),
    introNight:allocated.pools.raceNight.map(x=>({source:x.file,dropSeconds:x.dropSeconds,method:x.dropMethod})),
    menu:allocated.menu.file,skipped:allocated.skipped.map(x=>x.file)};
  const reportFile=path.join(planDir,'report.json');fs.writeFileSync(reportFile,JSON.stringify(report,null,2));
  const textLines=['NFS Heat Music Builder — initial automatic assignments','',
    'Source folder: '+sourceDir,'',
    'Classification estimates track intensity from audio energy; review the assignments before installing.',
    'The drop is estimated automatically and may not match the exact musical drop.',
    'During races, the intro track plays from the drop to its end before the next playlist track.','',
    'MENU: '+path.basename(allocated.menu.file),''];
  for(const key of keys){textLines.push(key.toUpperCase()+' ('+allocated.pools[key].length+')');
    allocated.pools[key].forEach((item,i)=>textLines.push('  '+String(i+1).padStart(2,'0')+'  '+path.basename(item.file)));
    textLines.push('');}
  for(const [label,key] of [['DAY RACE INTRO','raceDay'],['NIGHT RACE INTRO','raceNight']]){
    textLines.push(label+' (reuses race tracks)');
    allocated.pools[key].forEach((item,i)=>textLines.push('  '+String(i+1).padStart(2,'0')+'  '+
      item.dropSeconds.toFixed(1)+' s  '+path.basename(item.file)+
      (item.dropMethod==='fallback'?'  [estimate without a strong transition]':'')));
    textLines.push('');}
  if(allocated.skipped.length){textLines.push('NOT INCLUDED (59-slot limit)');
    allocated.skipped.forEach(item=>textLines.push('  '+path.basename(item.file)));}
  const readableReport=path.join(planDir,'report.txt');
  fs.writeFileSync(readableReport,'\ufeff'+textLines.join('\r\n')+'\r\n');
  console.log('AUTO_PLAN',readableReport);
  console.log('AUTO_PLAN_JSON',reportFile);
  for(const key of keys)console.log('AUTO_PLAYLIST',key,allocated.pools[key].length,
    allocated.pools[key].map(x=>path.basename(x.file)).join(' | '));
  console.log('AUTO_MENU',path.basename(allocated.menu.file));
  if(allocated.skipped.length)console.log('WARNING',allocated.skipped.length,'tracks did not fit in the 59 slots');
  if(editPlan)return;
  const builder=path.join(__dirname,'HeatMusicIntroPlaylistBuilder.js');
  await streamRun(process.execPath,[builder,configFile,...(planOnly?['--dry-run']:prepareOnly?['--prepare-only']:[])],
    planOnly?120000:9000000);
}
main().catch(e=>{console.error('ERROR:',e.stack||e.message);process.exitCode=1;});

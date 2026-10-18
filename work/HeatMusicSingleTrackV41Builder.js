'use strict';

// A one-song library does not need to rewrite every licensed wave in the game.
// Reuse the isolated V4.1 topology that was confirmed in gameplay: one complete
// wave per context, the two menu waves and one day/night race-intro sequence.
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {spawn}=require('child_process');
const {createFreshBuildFolder}=require('./HeatMusicBuildFolders');
const root=path.resolve(__dirname,'..');
const audioExtensions=new Set(['.wav','.mp3','.flac','.m4a']);

function files(dir){
  if(!fs.statSync(dir,{throwIfNoEntry:false})?.isDirectory())throw new Error('Missing staged playlist: '+dir);
  return fs.readdirSync(dir,{withFileTypes:true}).filter(x=>x.isFile()&&audioExtensions.has(path.extname(x.name).toLowerCase()))
    .map(x=>path.join(dir,x.name));
}
function run(script,args,timeout=7200000){return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[path.join(__dirname,script),...args],{cwd:root,stdio:'inherit',windowsHide:true});
  const timer=setTimeout(()=>child.kill(),timeout);
  child.once('error',error=>{clearTimeout(timer);reject(error);});
  child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(new Error(script+' exited '+code));});
});}
async function main(){
  const source=process.argv[2]?path.resolve(process.argv[2]):'';
  if(!fs.statSync(source,{throwIfNoEntry:false})?.isFile())throw new Error('Configuration JSON required');
  const input=JSON.parse(fs.readFileSync(source,'utf8'));
  const chosen={};
  for(const key of ['freeDriveDay','freeDriveNight','raceDay','raceNight','garage','introDay','introNight']){
    const list=files(input.slots&&input.slots[key]);
    if(list.length!==1)throw new Error('V4.1 compatibility mode requires exactly one staged track in '+key);
    chosen[key]=list[0];
  }
  if(!fs.statSync(input.slots.menu,{throwIfNoEntry:false})?.isFile())throw new Error('Menu track is missing');
  const hashes=new Set(Object.values(chosen).concat(input.slots.menu).map(file=>
    crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')));
  if(hashes.size!==1)throw new Error('V4.1 compatibility mode requires one identical source track');
  const dropDay=Number(input.introDrops&&input.introDrops[chosen.introDay]);
  const dropNight=Number(input.introDrops&&input.introDrops[chosen.introNight]);
  if(!Number.isFinite(dropDay)||!Number.isFinite(dropNight))throw new Error('Race-intro drop is missing');
  const id='HeatMusic_'+new Date().toISOString().replace(/[-:T.Z]/g,'').slice(0,14)+'_'+crypto.randomBytes(3).toString('hex');
  const folder=createFreshBuildFolder(path.join(root,'output','custom-builds'),id);
  const config={slots:{
    freeDriveDay:chosen.freeDriveDay,freeDriveNight:chosen.freeDriveNight,
    raceDay:chosen.raceDay,raceNight:chosen.raceNight,garage:chosen.garage,
    menu:input.slots.menu,introDay:chosen.introDay,introNight:chosen.introNight},
    dropDaySeconds:dropDay,dropNightSeconds:dropNight};
  const configFile=path.join(folder,'v41-isolated-config.json');
  fs.writeFileSync(configFile,JSON.stringify(config,null,2),{flag:'wx'});
  console.log('ONE_TRACK_V41_COMPATIBILITY','19 isolated waves; full 199-wave expansion disabled');
  await run('HeatMusicBuilder.js',[configFile,'--prepare-only','--resume',id]);
  if(process.argv.includes('--prepare-only')){console.log('PREPARED_SINGLE_TRACK',folder);return;}
  await run('ExportPreparedHeatMusic.js',[folder],120000);
}
if(require.main===module)main().catch(error=>{console.error('ERROR:',error.stack||error.message);process.exitCode=1;});


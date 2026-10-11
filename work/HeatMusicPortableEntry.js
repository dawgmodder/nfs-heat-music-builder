const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
const root=path.resolve(__dirname,'..');
const node=process.execPath;
const runtime=path.join(root,'runtime');
const toolsDir=path.join(runtime,'tools');
process.env.HEAT_MUSIC_FROSTY_RUNTIME=path.join(runtime,'FrostyEditor');
process.env.HEAT_MUSIC_CONVERTER=path.join(toolsDir,'dandev-el3.exe');
process.env.HEAT_MUSIC_FFMPEG=path.join(toolsDir,'ffmpeg.exe');
process.env.HEAT_MUSIC_FFPROBE=path.join(toolsDir,'ffprobe.exe');
if(!process.env.HEAT_MUSIC_GAME)throw new Error('NFS Heat folder not selected');
const plannerArgs=process.argv.slice(2);
const install=plannerArgs.includes('--use-plan');
function run(script,args){return new Promise((resolve,reject)=>{
  const child=spawn(node,[path.join(__dirname,script),...args],
    {cwd:root,stdio:'inherit',windowsHide:true,env:process.env});
  child.on('error',reject);
  child.on('exit',(code,signal)=>code===0?resolve():reject(new Error(script+' exited '+code+(signal?' signal '+signal:''))));
});}
(async()=>{
  if(!fs.existsSync(path.join(root,'output','playlist-placements.json')))
    throw new Error('Context data missing from package');
  await run('HeatMusicPortableSetup.js',install?['--install']:[]);
  if(install){
    const report=require('./HeatMusicGameAudit').audit(process.env.HEAT_MUSIC_GAME,root);
    fs.writeFileSync(path.join(root,'output','game-audit-v326.json'),JSON.stringify(report,null,2));
    console.log('GAME_AUDIO_VERIFIED',report.verified,'original resources');
  }
  await run('HeatMusicAutoPlanner.js',plannerArgs);
})().catch(error=>{console.error('ERROR:',error.stack||error.message);process.exitCode=1;});

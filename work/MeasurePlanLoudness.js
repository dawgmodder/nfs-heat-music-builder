const fs=require('fs');
const path=require('path');
const {spawnSync}=require('child_process');
const config=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const ffmpeg=require('./HeatMusicPaths').ffmpeg;
const files=[...new Set([config.slots.menu,...Object.entries(config.slots)
  .filter(([key])=>key!=='menu').flatMap(([,dir])=>fs.readdirSync(dir).map(name=>path.join(dir,name)))])];
for(const file of files){
  const r=spawnSync(ffmpeg,['-hide_banner','-nostats','-i',file,
    '-af','loudnorm=I=-18:TP=-1:LRA=11:print_format=json','-f','null','NUL'],
    {encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:8*1024*1024});
  if(r.status!==0)throw new Error('Measure failed '+file+' '+r.stderr.slice(-500));
  const m=r.stderr.match(/\{\s*"input_i"[\s\S]*?\}/);
  if(!m)throw new Error('No loudness '+file);
  const data=JSON.parse(m[0]),gain=-18-Number(data.input_i)+0.35;
  if(Number(data.input_tp)+gain>-1)
    console.log('UNSAFE_GAIN',path.basename(file),data.input_i,data.input_tp,gain.toFixed(2));
}
console.log('MEASURED',files.length);

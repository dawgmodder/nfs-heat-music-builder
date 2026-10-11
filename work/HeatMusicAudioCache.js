// Portable, content-addressed audio results. Never caches game data or executables.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=process.env.HEAT_MUSIC_AUDIO_CACHE_ROOT?path.resolve(process.env.HEAT_MUSIC_AUDIO_CACHE_ROOT):path.resolve(__dirname,'..','output','audio-cache-v1');
const owners=new Map();
function hash(file){const h=crypto.createHash('sha256'),b=Buffer.alloc(1024*1024),fd=fs.openSync(file,'r');
  try{let n;while((n=fs.readSync(fd,b,0,b.length,null)))h.update(b.subarray(0,n));}finally{fs.closeSync(fd);}return h.digest('hex');}
function digest(value){return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');}
let engine;
function signature(){if(engine)return engine;const p=require('./HeatMusicPaths');
  return engine=digest(['audio-pipeline-3.23-1',...[p.ffmpeg,p.ffprobe,p.converter,
    path.join(__dirname,'DecodeOriginalEaForLoudness.exe')].map(hash)]);}
function memo(kind,input,params,produce,target,validate){
  require('./HeatMusicCancellation').checkCancellation();
  const sourceHash=hash(input),owner=owners.get(sourceHash)||sourceHash;
  const spec={version:1,engine:signature(),kind,input:sourceHash,params};
  const key=digest(spec),roots=[root,process.env.HEAT_MUSIC_PRESET_CACHE].filter(Boolean);
  for(const dir of roots){try{
    const record=JSON.parse(fs.readFileSync(path.join(dir,key+'.json'),'utf8'));
    if(record.key!==key||digest(record.spec)!==key||record.owner!==owner)continue;
    const result={...record.result};
    if(target){const ext=path.extname(target),asset=path.join(dir,key+ext);
      if(!['.wav','.ealayer3'].includes(ext)||record.ext!==ext||hash(asset)!==record.sha256)continue;
      if(ext==='.wav'&&(!Number.isFinite(result.duration)||result.duration<20||
        !Number.isFinite(result.after?.lufs)||Math.abs(result.after.lufs+17.65)>0.35||
        !Number.isFinite(result.after?.truePeak)||result.after.truePeak>-0.9))continue;
      if(ext==='.ealayer3'&&(!Number.isFinite(result.seconds)||result.seconds<=0||
        result.bytes!==fs.statSync(asset).size||result.sha256!==record.sha256))continue;
      // Repair only a private copy: presets and shared cache assets are immutable.
      fs.copyFileSync(asset,target);result[ext==='.wav'?'wav':'file']=target;
      if(validate)Object.assign(result,validate(result)||{});
      const finalHash=hash(target);
      if(ext==='.ealayer3'){result.sha256=finalHash;result.bytes=fs.statSync(target).size;}
      owners.set(finalHash,owner);
    }else if(validate)Object.assign(result,validate(result)||{});
    require('./HeatMusicCancellation').checkCancellation();
    console.log('REUSED_PORTABLE_AUDIO',kind,path.basename(input));return result;
  }catch(error){if(error.code!=='ENOENT')console.log('CACHE_IGNORED',kind,error.message.slice(0,160));}}
  const result=produce();if(validate)Object.assign(result,validate(result)||{});
  const clean={...result};delete clean.source;delete clean.sourceBytes;delete clean.sourceMtimeMs;
  delete clean.wav;delete clean.file;
  const record={key,spec,owner,result:clean};
  fs.mkdirSync(root,{recursive:true});
  if(target){const file=result.wav||result.file;record.ext=path.extname(file);
    if(!['.wav','.ealayer3'].includes(record.ext))throw new Error('Unsafe cache extension');
    record.sha256=hash(file);owners.set(record.sha256,owner);
    const dest=path.join(root,key+record.ext),temp=dest+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';
    try{fs.copyFileSync(file,temp);fs.renameSync(temp,dest);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
  }
  const dest=path.join(root,key+'.json'),temp=dest+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';
  try{fs.writeFileSync(temp,JSON.stringify(record));fs.renameSync(temp,dest);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
  return result;
}
module.exports={memo,hash};

const fs=require('fs');
const crypto=require('crypto');

function hash(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}

// Validate EA Layer3 and repair only the dandev-el3 2^24 sample-counter wrap.
// The caller supplies its own duration tolerance and logger.
function inspectEa(file,requested,maxShortfall=0.65,options={}){
  const log=options.log||console.log;
  let raw;
  try{raw=fs.readFileSync(file);}catch(error){throw new Error('EA file unreadable: '+file+' '+error.message);}
  if(raw.length<24)throw new Error('EA file incomplete: '+file);
  if(raw.readUInt32BE(0)!==0x4800000c||raw[4]!==0x16||raw[5]!==4||
    raw.readUInt16BE(6)!==48000||raw.subarray(-4).toString('hex')!=='45000004')
    throw new Error('EA format/terminator invalid: '+file);
  let p=12,frames=0,blocks=0;
  while(p<raw.length-4){
    if(p+8>raw.length-4)throw new Error('EA block header truncated: '+file);
    const tag=raw.readUInt32BE(p),bytes=tag&0xffffff;
    if((tag>>>24)!==0x44||bytes<8||p+bytes>raw.length-4)
      throw new Error('EA block invalid or truncated: '+file);
    frames+=raw.readUInt32BE(p+4);p+=bytes;blocks++;
  }
  if(p!==raw.length-4||blocks===0)throw new Error('EA payload incomplete: '+file);
  if(frames<=0||frames>0x3fffffff)throw new Error('EA sample count exceeds 30-bit field: '+file);
  const headerFrames=raw.readUInt32BE(8)&0x3fffffff;
  const seconds=frames/48000;
  if(!Number.isFinite(requested)||requested<=0||!Number.isFinite(maxShortfall)||maxShortfall<0||seconds>requested+0.1||requested-seconds>maxShortfall)
    throw new Error('EA duration mismatch: '+file+' '+seconds+'/'+requested);
  let repaired=false;
  if(frames!==headerFrames){
    const delta=frames-headerFrames,wrap=0x1000000;
    if(delta<=0||delta%wrap!==0||headerFrames>=wrap||headerFrames!==frames%wrap)
      throw new Error('EA header/block sample mismatch: '+file+' header '+(headerFrames/48000)+' blocks '+seconds);
    if(options.repair===false)throw new Error('EA header requires repair: '+file);
    const repairedHeader=((raw.readUInt32BE(8)&0xc0000000)|(frames&0x3fffffff))>>>0;
    raw=Buffer.from(raw);raw.writeUInt32BE(repairedHeader,8);fs.writeFileSync(file,raw);repaired=true;
    log('REPAIRED_EA_SAMPLE_COUNT',file,'header',headerFrames,'blocks',frames,'duration',seconds.toFixed(3));
    return {...inspectEa(file,requested,maxShortfall,{...options,repair:false}),repaired:true};
  }
  return {file,bytes:raw.length,seconds,frames,blocks,sha256:hash(raw),repaired};
}
module.exports={inspectEa};

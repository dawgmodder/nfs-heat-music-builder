const fs=require('fs');

function partialDuration(file){
  if(!fs.existsSync(file))return null;
  const b=fs.readFileSync(file);
  if(b.length<10000||b.readUInt32BE(0)!==0x4800000c)return null;
  if(b.subarray(-4).toString('hex')==='45000004')return null;
  let p=12,frames=0;
  while(p+8<=b.length-4){
    const tag=b.readUInt32BE(p),bytes=tag&0xffffff;
    if((tag>>>24)!==0x44||bytes<8||p+bytes>b.length-4)break;
    frames+=b.readUInt32BE(p+4);p+=bytes;
  }
  return frames>480000?frames/48000:null;
}

function nextRequest(current,partials,step){
  const valid=partials.filter(x=>Number.isFinite(x)&&x<current-0.5);
  if(valid.length<2)return current-step;
  const a=valid[valid.length-1],b=valid[valid.length-2];
  if(Math.abs(a-b)>0.5)return current-step;
  return Math.min(current-step,Math.floor((Math.min(a,b)-0.15)*10)/10);
}

module.exports={partialDuration,nextRequest};

// Read-only audit of the exact original music chunks used by this builder.
const fs=require('fs'),path=require('path'),assert=require('assert');
function guidBytes(id){const b=Buffer.from(id.replace(/-/g,''),'hex');return Buffer.from([...b.subarray(0,4)].reverse().concat([...b.subarray(4,6)].reverse(),[...b.subarray(6,8)].reverse(),[...b.subarray(8)])).reverse();}
function audit(game,root=path.resolve(__dirname,'..')){
 const toc={};for(const layer of ['Data','Patch'])toc[layer]=fs.readFileSync(path.join(game,layer,'Win32/chunks0.toc'));
 function find(id){for(const layer of ['Patch','Data']){const t=toc[layer],g=t.readUInt32BE(572)+556,n=t.readUInt32BE(576),loc=t.readUInt32BE(580)+556;
  assert(n<100000);const key=guidBytes(id);for(let i=0;i<n;i++){const p=g+i*20;if(t.subarray(p,p+16).equals(key))return{layer,tocOffset:loc+(t.readUInt32BE(p+16)&0xffffff)*4};}}
  throw Error('Original chunk missing: '+id);}
 const entries=JSON.parse(fs.readFileSync(path.join(root,'output/playlist-placements.json')));
 const groups=new Map();
 for(const line of fs.readFileSync(path.join(root,'output/race-intro-track24-test/all-inventory.tsv'),'utf8').trim().split(/\r?\n/).slice(1)){
  const [context,phrase,index,,name,guid,,seconds]=line.split('\t');
  entries.push({name,guid,expectedSeconds:Number(seconds),...find(guid)});const key=context+'/'+phrase;
  if(!groups.has(key))groups.set(key,0);if(+index<5)groups.set(key,groups.get(key)+Number(seconds));
 }
 for(const [name,id]of [['menuLead','3c3bb786-ab5f-2d33-9236-041232c32c14'],['menuLoop','87b13ed0-2043-71d4-a847-55d6dd4a7a4e']])entries.push({name,guid:id,...find(id)});
 const results=[];
 for(const e of entries){const t=toc[e.layer],p=e.tocOffset,offset=t.readUInt32BE(p+4),size=t.readUInt32BE(p+8);
  if(e.location)assert.equal(t.subarray(p,p+12).toString('hex'),e.location,e.name+' TOC differs');
  const cas=path.join(game,e.layer,'Win32/configurations',t[p+2]===1?'superbundleinstallpackage2':'superbundleinstallpackage','cas_'+String(t[p+3]).padStart(2,'0')+'.cas');
  assert(offset+size<=fs.statSync(cas).size);const fd=fs.openSync(cas,'r'),wrapped=Buffer.alloc(size);
  try{assert.equal(fs.readSync(fd,wrapped,0,size,offset),size);}finally{fs.closeSync(fd);}
  const parts=[];for(let k=0;k<size;){assert(k+8<=size);const codec=wrapped.readUInt16LE(k+4)&0x7f;
   assert([0,0x70,0x71].includes(codec));const n=wrapped.readUInt16BE(k+6)||wrapped.readUInt32BE(k);assert(k+8+n<=size);
   parts.push(wrapped.subarray(k+8,k+8+n));k+=8+n;}
  const b=Buffer.concat(parts);assert.equal(b.readUInt32BE(0),0x4800000c);
  let k=12,frames=0,end=false;while(k<b.length){const tag=b.readUInt32BE(k),n=tag&0xffffff;assert(n>=4&&k+n<=b.length);
   if(tag>>>24===0x45){end=k+n===b.length;break;}assert.equal(tag>>>24,0x44);assert(n>=8);frames+=b.readUInt32BE(k+4);k+=n;}
  assert(end);assert.equal(frames,b.readUInt32BE(8)&0x3fffffff,e.name);
  if(e.expectedSeconds!==undefined)assert(Math.abs(frames/b.readUInt16BE(6)-e.expectedSeconds)<0.002,e.name+' duration differs from intro inventory');
  results.push({name:e.name,layer:e.layer,codec:b[4],rate:b.readUInt16BE(6),seconds:frames/b.readUInt16BE(6),bytes:b.length});
 }
 return {verified:results.length,codecs:[...new Set(results.map(x=>x.codec))],rates:[...new Set(results.map(x=>x.rate))],
  shortest:Math.min(...results.map(x=>x.seconds)),longest:Math.max(...results.map(x=>x.seconds)),
  intros:[...groups].map(([name,seconds])=>({name,preRaceSeconds:seconds})),resources:results};
}
if(require.main===module){const report=audit(require('./HeatMusicPaths').game);const out=path.resolve('output/v326-game-audit.json');fs.writeFileSync(out,JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,resources:undefined},null,2));console.log('REPORT',out);}
module.exports={audit};

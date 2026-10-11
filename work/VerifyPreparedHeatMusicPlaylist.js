const fs=require('fs');const path=require('path');const crypto=require('crypto');
const workspace=path.resolve(__dirname,'..');
const folder=process.argv[2]?path.resolve(process.argv[2]):'';
const allowed=path.join(workspace,'output','custom-builds');
if(path.dirname(folder)!==allowed)throw new Error('Expected one prepared custom-builds folder');
const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
if(manifest.id!==path.basename(folder)||manifest.placements.length!==84||!manifest.patchAudio)
  throw new Error('Expected 84 Data placements and one Patch placement');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const toc=fs.readFileSync(path.join(folder,'chunks0.toc'));
if(hash(toc)!==manifest.tocSha256)throw new Error('Data TOC digest mismatch');
const casPaths={8:path.join(folder,'cas_08.cas'),13:path.join(folder,'cas_13.cas'),14:path.join(folder,'cas_14.cas')};
const fds={};
function unwrap(wrapped){const pieces=[];
  for(let p=0;p<wrapped.length;){if(p+8>wrapped.length)throw new Error('Short CAS header');
    const n=wrapped.readUInt32BE(p);if(n<1||p+8+n>wrapped.length)throw new Error('Invalid CAS block');
    pieces.push(wrapped.subarray(p+8,p+8+n));p+=8+n;}
  return Buffer.concat(pieces);
}
try{
  for(const n of [8,13,14]){
    if(fs.statSync(casPaths[n]).size!==manifest.casBytes[n])throw new Error('CAS size mismatch '+n);
    fds[n]=fs.openSync(casPaths[n],'r');
  }
  const seen=new Set();
  for(const item of manifest.placements){
    if(seen.has(item.name.toLowerCase()))throw new Error('Duplicate wave '+item.name);
    seen.add(item.name.toLowerCase());
    const p=item.tocOffset;
    if(toc[p+3]!==item.cas||toc.readUInt32BE(p+4)!==item.newOffset||toc.readUInt32BE(p+8)!==item.newSize)
      throw new Error('TOC mismatch '+item.name);
    const wrapped=Buffer.alloc(item.newSize);
    if(fs.readSync(fds[item.cas],wrapped,0,wrapped.length,item.newOffset)!==wrapped.length)
      throw new Error('CAS short read '+item.name);
    const raw=unwrap(wrapped);
    if(raw.length!==item.audioBytes||hash(raw)!==item.audioSha256||raw.subarray(-4).toString('hex')!=='45000004')
      throw new Error('Audio mismatch '+item.name);
  }
}finally{for(const fd of Object.values(fds))fs.closeSync(fd);}
const patch=manifest.patchAudio,patchEa=fs.readFileSync(path.join(folder,'playlist-patch.ealayer3'));
if(patchEa.length!==patch.audioBytes||hash(patchEa)!==patch.audioSha256)
  throw new Error('Patch audio mismatch');
const patchToc=fs.readFileSync(path.join(folder,'playlist-patch-chunks0.toc'));
if(patchToc.subarray(patch.tocOffset,patch.tocOffset+12).toString('hex')!==patch.oldLocation)
  throw new Error('Patch TOC source mismatch');
if(!fs.existsSync(path.join(folder,manifest.metadataFile||'metadata.fbmod')))
  throw new Error('Frosty metadata absent');
const lines=fs.readFileSync(path.join(folder,'waves.tsv'),'utf8').trim().split(/\r?\n/);
if(lines.length!==85||new Set(lines.map(x=>x.split('\t')[0].toLowerCase())).size!==85)
  throw new Error('Expected 85 unique metadata waves');
console.log('VERIFIED_PREPARED',manifest.id,'84 Data + 1 Patch, all audio hashes and metadata rows');

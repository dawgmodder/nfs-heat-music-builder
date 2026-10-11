const fs=require('fs');const path=require('path');const crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const folder=process.argv[2]?path.resolve(process.argv[2]):'';
if(path.dirname(folder)!==path.join(root,'output','custom-builds'))
  throw new Error('Expected one prepared custom-builds folder');
const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
if(manifest.id!==path.basename(folder)||manifest.placements.length!==192||
   !manifest.patchAudio||!Array.isArray(manifest.patchExtras)||manifest.patchExtras.length!==6||
   !Array.isArray(manifest.introAssignments)||manifest.introAssignments.length!==21)
  throw new Error('Expected 192 Data and seven Patch placements');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const toc=fs.readFileSync(path.join(folder,'chunks0.toc'));
if(hash(toc)!==manifest.tocSha256)throw new Error('Data TOC digest mismatch');
const casPaths={8:path.join(folder,'cas_08.cas'),13:path.join(folder,'cas_13.cas'),14:path.join(folder,'cas_14.cas')};
const fds={};
function unwrap(wrapped){const pieces=[];
  for(let p=0;p<wrapped.length;){if(p+8>wrapped.length)throw new Error('Short CAS header');
    const n=wrapped.readUInt32BE(p);if(n<1||p+8+n>wrapped.length)throw new Error('Invalid CAS block');
    pieces.push(wrapped.subarray(p+8,p+8+n));p+=8+n;}
  return Buffer.concat(pieces);}
try{
  for(const n of [8,13,14]){if(fs.statSync(casPaths[n]).size!==manifest.casBytes[n])
    throw new Error('CAS size mismatch '+n);fds[n]=fs.openSync(casPaths[n],'r');}
  const seen=new Set();
  for(const item of manifest.placements){
    if(seen.has(item.name.toLowerCase()))throw new Error('Duplicate wave '+item.name);
    seen.add(item.name.toLowerCase());const p=item.tocOffset;
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
const patchToc=fs.readFileSync(path.join(folder,'playlist-patch-chunks0.toc'));
for(const item of [manifest.patchAudio,...manifest.patchExtras]){
  if(patchToc.subarray(item.tocOffset,item.tocOffset+12).toString('hex')!==item.oldLocation)
    throw new Error('Patch original location mismatch '+item.name);
  const rel=item.audioFile||'playlist-patch.ealayer3',file=path.resolve(folder,rel);
  if(!file.startsWith(folder+path.sep))throw new Error('Unsafe audio file '+item.name);
  const raw=fs.readFileSync(file);
  if(raw.length!==item.audioBytes||hash(raw)!==item.audioSha256||raw.subarray(-4).toString('hex')!=='45000004')
    throw new Error('Patch audio mismatch '+item.name);
}
if(!fs.existsSync(path.join(folder,manifest.metadataFile)))throw new Error('Frosty metadata absent');
const lines=fs.readFileSync(path.join(folder,'waves.tsv'),'utf8').trim().split(/\r?\n/);
if(lines.length!==199||new Set(lines.map(x=>x.split('\t')[0].toLowerCase())).size!==199)
  throw new Error('Expected 199 unique metadata waves');
console.log('VERIFIED_PREPARED_INTRO_PLAYLIST',manifest.id,'192 Data + 7 Patch, 21 intro sequences');

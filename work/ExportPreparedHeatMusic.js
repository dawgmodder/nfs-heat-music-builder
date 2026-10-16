const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

function sha256(file){
  const hash=crypto.createHash('sha256'),buffer=Buffer.allocUnsafe(1024*1024);
  const fd=fs.openSync(file,'r');
  try{let size;while((size=fs.readSync(fd,buffer,0,buffer.length,null))>0)
    hash.update(buffer.subarray(0,size));}
  finally{fs.closeSync(fd);}
  return hash.digest('hex');
}

function main(){
  const root=path.resolve(__dirname,'..');
  const folder=process.argv[2]?path.resolve(process.argv[2]):'';
  const builds=path.join(root,'output','custom-builds');
  if(!folder||path.dirname(folder)!==builds||!/^HeatMusic_\d{14}_[0-9a-f]{6}$/.test(path.basename(folder)))
    throw new Error('Unsafe or missing prepared build folder');
  const manifestFile=path.join(folder,'manifest.json');
  const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
  if(manifest.id!==path.basename(folder)||manifest.placements.length!==192||
     !Array.isArray(manifest.patchExtras)||manifest.patchExtras.length!==6||!manifest.patchAudio)
    throw new Error('Prepared soundtrack is incomplete; expected 192 data waves and 7 patch waves');
  const metadataName=manifest.metadataFile||'intro-playlist-metadata.fbmod';
  const metadata=path.resolve(folder,metadataName);
  if(path.dirname(metadata)!==folder||!fs.existsSync(metadata)||fs.statSync(metadata).size<1024)
    throw new Error('Self-contained Frosty mod file is missing or invalid');
  const rows=fs.readFileSync(path.join(folder,'waves.tsv'),'utf8').trim().split(/\r?\n/);
  if(rows.length!==199)throw new Error('Audio manifest does not contain all 199 soundtrack chunks');
  const expectedAudio=new Map();
  for(const item of [...manifest.placements,...manifest.patchExtras,manifest.patchAudio]){
    if(!item||!item.name||!item.audioSha256||!Number.isInteger(item.audioBytes)||expectedAudio.has(item.name))
      throw new Error('Prepared build has incomplete or duplicate audio metadata');
    expectedAudio.set(item.name,{sha256:item.audioSha256,bytes:item.audioBytes});
  }
  if(expectedAudio.size!==rows.length)throw new Error('Audio metadata does not match the wave list');
  for(let i=0;i<rows.length;i++){
    const fields=rows[i].split('\t');
    if(fields.length!==4)throw new Error('Missing embedded audio path at row '+(i+1));
    const expected=Number(fields[1]);
    const audio=path.resolve(folder,fields[3]);
    const manifestAudio=expectedAudio.get(fields[0]);
    if(path.dirname(audio)!==path.join(folder,'audio')||!fs.existsSync(audio)||
       !manifestAudio||manifestAudio.bytes!==expected||fs.statSync(audio).size!==expected||
       sha256(audio)!==manifestAudio.sha256)
      throw new Error('Embedded audio path or size mismatch at row '+(i+1));
  }
  const output=path.join(root,'output','exports');
  fs.mkdirSync(output,{recursive:true});
  const name='NFSHeatCustomSoundtrack_'+manifest.id+'.fbmod';
  const target=path.join(output,name);
  fs.copyFileSync(metadata,target,fs.constants.COPYFILE_EXCL);
  const digest=sha256(target);
  console.log('EXPORT_READY',target);
  console.log('EXPORT_SHA256',digest);
  console.log('FROSTY_INSTRUCTIONS','Open Mods & Launch, import an FBPACK or add individual FBMODs, then launch. The soundtrack FBMOD is applied last automatically by the GPL manager.');
}

if(require.main===module)try{main();}catch(error){console.error('EXPORT_ERROR:',error.stack||error.message);process.exitCode=1;}
module.exports={main,sha256};

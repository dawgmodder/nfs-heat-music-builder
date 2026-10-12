// One-time setup. Downloads unmodified tools from their upstream release pages,
// verifies them, then extracts a key only from the player's installed game.
const fs=require('fs');
const path=require('path');
const https=require('https');
const crypto=require('crypto');
const {spawnSync}=require('child_process');
const paths=require('./HeatMusicPaths');
const {checkCancellation}=require('./HeatMusicCancellation');
const root=paths.root;
const runtimeRoot=path.join(root,'runtime');
const downloadDir=path.join(runtimeRoot,'downloads');
const unzip=path.join(__dirname,'ExtractTrustedZip.exe');
const expected={
  frosty:'6eca779aac4a150f1c46934c0455522269a1820b6d3e0b8727c13a81ca9106f8',
  sound:'8c91633470b5841e7b3ace75195ae6d0cceae5e1609e5a64a59d8efea9fb2225',
  support:'81c350fd7fc35919457f27818cc73d9c410f214c77ef64e1ddb83149edbdf672'
};
const urls={
  frosty:'https://github.com/CadeEvs/FrostyToolsuite/releases/download/v1.0.6.3/FrostyEditor.zip',
  sound:'https://github.com/DanielElam/bf2-sound-import/releases/download/1.3.3/FrostySoundImport-1.3.3.3.zip',
  ffmpeg:'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'
};
const allowedHosts=new Set(['github.com','release-assets.githubusercontent.com','www.gyan.dev']);
const shaFile=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function run(file,args,timeout=300000){
  const r=spawnSync(file,args,{cwd:root,encoding:'utf8',windowsHide:true,timeout,maxBuffer:4*1024*1024});
  if(r.status!==0)throw new Error(path.basename(file)+' failed: '+String(r.error||r.stderr||r.stdout).slice(-1500));
  if(r.stdout.trim())console.log(r.stdout.trim());
}
function fetch(url,asFile,redirects=0){return new Promise((resolve,reject)=>{
  if(redirects>5)return reject(new Error('Too many download redirects'));
  const parsed=new URL(url);
  if(parsed.protocol!=='https:'||!allowedHosts.has(parsed.hostname))
    return reject(new Error('Unexpected download host '+parsed.hostname));
  const req=https.get(parsed,{headers:{'User-Agent':'HeatMusicBuilder-Portable/1.0'}},response=>{
    if([301,302,303,307,308].includes(response.statusCode)){
      const next=new URL(response.headers.location,url).href;
      response.resume();fetch(next,asFile,redirects+1).then(resolve,reject);return;
    }
    if(response.statusCode!==200){response.resume();reject(new Error('Download HTTP '+response.statusCode));return;}
    if(!asFile){const chunks=[];let size=0;response.on('data',b=>{
      size+=b.length;if(size>1024*1024)req.destroy(new Error('Checksum response too large'));else chunks.push(b);
    });response.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));response.on('error',reject);return;}
    const out=fs.createWriteStream(asFile,{flags:'wx'});
    let size=0;response.on('data',b=>{size+=b.length;if(size>300*1024*1024)
      req.destroy(new Error('Archive exceeds download limit'));});
    response.on('error',reject);out.on('error',reject);
    out.on('finish',()=>resolve());response.pipe(out);
  });
  req.setTimeout(120000,()=>req.destroy(new Error('Download timed out')));
  req.on('error',reject);
});}
async function archive(name){
  checkCancellation();
  const archiveFile=path.join(downloadDir,name+'.zip');
  let expectedHash=expected[name];
  if(name==='ffmpeg'){
    const remote=await fetch(urls.ffmpeg+'.sha256',false);
    const match=remote.match(/\b([0-9a-f]{64})\b/i);
    if(!match)throw new Error('FFmpeg publisher checksum unavailable');
    expectedHash=match[1].toLowerCase();
  }
  if(fs.existsSync(archiveFile)&&shaFile(archiveFile)!==expectedHash){
    throw new Error('Archive checksum mismatch: '+archiveFile+'; remove it before retrying.');
  }
  if(!fs.existsSync(archiveFile)){
    const part=archiveFile+'.part';
    if(fs.existsSync(part))fs.unlinkSync(part);
    console.log('DOWNLOADING',name,urls[name]);
    try{await fetch(urls[name],part);if(shaFile(part)!==expectedHash)
      throw new Error('SHA-256 checksum mismatch for '+name);
      fs.renameSync(part,archiveFile);
    }catch(error){if(fs.existsSync(part))fs.unlinkSync(part);throw error;}
  }
  console.log('VERIFIED_DOWNLOAD',name);
  return archiveFile;
}
function extract(archiveFile,dest){
  if(fs.existsSync(dest))throw new Error('Partial/existing extraction needs inspection: '+dest);
  run(unzip,[archiveFile,dest],300000);
}
function findUnique(dir,name){
  const result=[];function walk(p){for(const item of fs.readdirSync(p,{withFileTypes:true})){
    const full=path.join(p,item.name);
    if(item.isDirectory())walk(full);else if(item.name.toLowerCase()===name.toLowerCase())result.push(full);
  }}walk(dir);if(result.length!==1)throw new Error('Expected exactly one '+name+' in '+dir);
  return result[0];
}
async function main(){
  const gameExe=path.join(paths.game,'NeedForSpeedHeat.exe');
  if(!fs.existsSync(gameExe)||!fs.existsSync(path.join(paths.game,'Data','Win32','chunks0.toc')))
    throw new Error('Selecione a pasta da instalação original do NFS Heat (Steam ou EA App).');
  if(!fs.existsSync(unzip))throw new Error('Extractor missing from portable package');
  fs.mkdirSync(downloadDir,{recursive:true});
  const frosty=paths.frostyRuntime;
  const support=path.join(frosty,'FrostyModSupport.dll');
  if(!fs.existsSync(support)){
    const archiveFile=await archive('frosty');
    const stage=path.join(runtimeRoot,'frosty-stage');
    extract(archiveFile,stage);
    const extracted=path.join(stage,'FrostyEditor');
    if(!fs.existsSync(path.join(extracted,'FrostyModSupport.dll')))
      throw new Error('Frosty archive layout changed');
    fs.renameSync(extracted,frosty);
    fs.rmdirSync(stage);
  }
  if(shaFile(support)!==expected.support)throw new Error('Frosty runtime does not match tested v1.0.6.3');
  console.log('FROSTY_RUNTIME_READY');
  const toolDir=path.join(runtimeRoot,'tools');
  fs.mkdirSync(toolDir,{recursive:true});
  const converterDll=path.join(toolDir,'libmpg123-0.dll');
  if(!fs.existsSync(paths.converter)||!fs.existsSync(converterDll)){
    const archiveFile=await archive('sound');
    const stage=path.join(runtimeRoot,'sound-stage');
    if(!fs.existsSync(stage))extract(archiveFile,stage);
    for(const [name,dest] of [['dandev-el3.exe',paths.converter],['libmpg123-0.dll',converterDll]])
      if(!fs.existsSync(dest))fs.copyFileSync(findUnique(stage,name),dest,fs.constants.COPYFILE_EXCL);
    console.log('EA_CONVERTER_READY');
  }
  if(!fs.existsSync(paths.converter)||!fs.existsSync(converterDll))
    throw new Error('EA Layer3 converter dependency missing');
  if(!fs.existsSync(paths.ffmpeg)||!fs.existsSync(paths.ffprobe)){
    const archiveFile=await archive('ffmpeg');
    const stage=path.join(runtimeRoot,'ffmpeg-stage');extract(archiveFile,stage);
    for(const [name,dest] of [['ffmpeg.exe',paths.ffmpeg],['ffprobe.exe',paths.ffprobe]])
      if(!fs.existsSync(dest))fs.copyFileSync(findUnique(stage,name),dest,fs.constants.COPYFILE_EXCL);
    console.log('FFMPEG_READY');
  }
  checkCancellation();
  run(process.execPath,[path.join(__dirname,'ExtractOwnedGameKey.js')],300000);
  console.log('PORTABLE_SETUP_READY');
}
main().catch(error=>{console.error('ERROR:',error.stack||error.message);process.exitCode=1;});

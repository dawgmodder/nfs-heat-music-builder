// Mechanical assembly of the redistributable bootstrap package.
// No game data, music, encryption key, Frosty binaries or FFmpeg binaries are copied.
const fs=require('fs');
const path=require('path');
const https=require('https');
const crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const packageName=process.argv[2]||'HeatMusicPortableV4_2_Distribution';
if(!/^HeatMusicPortableV4_2(?:_Distribution|_Final)?$/.test(packageName))
  throw new Error('Unexpected package name');
const target=path.join(root,'output',packageName);
const work=path.join(target,'work'),out=path.join(target,'output');
const files=[
  'HeatMusicAutoPlanner.js','HeatMusicPortableEntry.js','HeatMusicPortableSetup.js',
  'HeatVisualTheme.cs','HeatMusicBrand.cs','HeatMusicPresetStore.cs','HeatMusicAudioCache.js',
  'HeatMusicPaths.js','ExtractOwnedGameKey.js','BuildPortableBaseline.js',
  'HeatMusicCancellation.js','HeatMusicTiming.js','HeatMusicEaLayer3.js','HeatMusicEaEncoder.js','HeatMusicGameAudit.js','HeatMusicBuilder.js','HeatMusicPlaylistBuilder.js',
  'HeatMusicBuildFolders.js','RunHeatMetadata.js','ExportPreparedHeatMusic.js',
  'HeatMusicIntroPlaylistBuilder.js','NormalizeUnsafeAudio.js','EaBitrateCandidates.js',
  'EaPartialDuration.js','InstallPreparedHeatMusic.js',
  'VerifyPreparedHeatMusicIntroPlaylists.js','VerifyPreparedHeatMusicPlaylist.js',
  'MeasurePlanLoudness.js','ExtractTrustedZip.exe',
  'HeatTrack24SizeMod.exe','DecodeOriginalEaForLoudness.exe'
];
const manifests=['direct-track24-ealayer3-all-test','direct-track24-menu-loop-test',
  'direct-track24-menu-lead-loop-test','direct-track24-race-intro-test'];
const nodeSource=path.join(root,'output','portable-research','node.exe');
const nodeHash='e3be0545990c90995d7bf3a7af5d64af1f2e0fc1bbd9b79c27f7abc1e9676e50';
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function fetch(url,redirects=0){return new Promise((resolve,reject)=>{
  if(redirects>4||!['nodejs.org','raw.githubusercontent.com'].includes(new URL(url).hostname))
    return reject(new Error('Unexpected license redirect'));
  https.get(url,{headers:{'User-Agent':'HeatMusicBuilder-Packager/1.0'}},response=>{
    if([301,302,303,307,308].includes(response.statusCode)){
      const next=new URL(response.headers.location,url).href;
      response.resume();fetch(next,redirects+1).then(resolve,reject);return;
    }
    if(response.statusCode!==200){response.resume();reject(new Error('HTTP '+response.statusCode));return;}
    const chunks=[];let size=0;
    response.on('data',b=>{size+=b.length;if(size>5*1024*1024)
      response.destroy(new Error('License too large'));else chunks.push(b);});
    response.on('end',()=>resolve(Buffer.concat(chunks)));
    response.on('error',reject);
  }).on('error',reject);
});}
async function main(){
  if(fs.existsSync(target))throw new Error('Package already exists: '+target);
  if(hash(nodeSource)!==nodeHash)throw new Error('Node.js executable checksum mismatch');
  const localLicense=path.join(root,'output','HeatMusicPortableV3_25_Final','NODE-LICENSE.txt');
  const license=fs.existsSync(localLicense)?fs.readFileSync(localLicense):await fetch('https://raw.githubusercontent.com/nodejs/node/v24.13.1/LICENSE');
  if(!license.toString('utf8').includes('Node.js is licensed for use as follows'))
    throw new Error('Unexpected Node.js license document');
  fs.mkdirSync(work,{recursive:true});fs.mkdirSync(out);
  fs.mkdirSync(path.join(target,'runtime'));
  fs.copyFileSync(nodeSource,path.join(target,'runtime','node.exe'));
  fs.writeFileSync(path.join(target,'NODE-LICENSE.txt'),license);
  fs.copyFileSync(path.join(__dirname,'HeatMusicInstallerV4_2.exe'),
    path.join(target,'HeatMusicInstallerV4_2.exe'));
  fs.copyFileSync(path.join(__dirname,'README-English-V4_2.txt'),
    path.join(target,'README.txt'));
  for(const name of files)fs.copyFileSync(path.join(__dirname,name),path.join(work,name));
  for(const name of manifests){
    const source=path.join(root,'output',name,'manifest.json');
    const json=JSON.parse(fs.readFileSync(source,'utf8'));
    delete json.source;delete json.baseline;delete json.sourceBaseline;
    const dir=path.join(out,name);fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(json,null,2));
  }
  fs.copyFileSync(path.join(root,'output','playlist-placements.json'),
    path.join(out,'playlist-placements.json'));
  const intro=path.join(out,'race-intro-track24-test');fs.mkdirSync(intro);
  for(const name of ['waves.tsv','all-inventory.tsv'])
    fs.copyFileSync(path.join(root,'output','race-intro-track24-test',name),path.join(intro,name));
  console.log('PORTABLE_PACKAGE_READY',target);
}
main().catch(error=>{console.error('ERRO:',error.stack||error.message);process.exitCode=1;});

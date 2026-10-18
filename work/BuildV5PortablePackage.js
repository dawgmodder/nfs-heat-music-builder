'use strict';
const fs=require('fs'),path=require('path');
const repo=path.resolve(__dirname,'..'),root=path.resolve(repo,'..');
const finalTarget=path.join(root,'output','HeatMusicPortableV5_Beta5_OneTrackCompatibility');
const target=finalTarget+'.building';
const baseline=path.join(root,'output','HeatMusicPortableV4_1_Distribution');
const frostBuild=path.join(root,'frostysource-current','FrostyCli','bin','Release','net8.0');
const dotnetRoot=path.join(root,'runtime','dotnet8');
if(fs.existsSync(finalTarget))throw new Error('Target already exists: '+finalTarget);
if(fs.existsSync(target))fs.rmSync(target,{recursive:true,force:true});
function copy(source,destination){if(!fs.existsSync(source))throw new Error('Missing package input: '+source);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(source,destination);}
function copyTree(source,destination,filter=()=>true){for(const entry of fs.readdirSync(source,{withFileTypes:true})){const from=path.join(source,entry.name),to=path.join(destination,entry.name);if(!filter(from,entry))continue;if(entry.isDirectory()){fs.mkdirSync(to,{recursive:true});copyTree(from,to,filter);}else if(entry.isFile())copy(from,to);}}
const workFiles=[
  'HeatMusicAutoPlanner.js','HeatMusicSingleTrackV41Builder.js','HeatMusicPortableEntry.js','HeatMusicPortableSetup.js','HeatVisualTheme.cs','HeatMusicBrand.cs','HeatGameLauncher.cs','HeatMusicPresetStore.cs','HeatMusicAudioCache.js','HeatMusicPaths.js','ExtractOwnedGameKey.js','BuildPortableBaseline.js','HeatMusicCancellation.js','HeatMusicTiming.js','HeatMusicEaLayer3.js','HeatMusicEaEncoder.js','HeatMusicGameAudit.js','HeatMusicBuilder.js','HeatMusicPlaylistBuilder.js','HeatMusicBuildFolders.js','RunHeatMetadata.js','ExportPreparedHeatMusic.js','HeatMusicIntroPlaylistBuilder.js','NormalizeUnsafeAudio.js','EaBitrateCandidates.js','EaPartialDuration.js','InstallPreparedHeatMusic.js','VerifyPreparedHeatMusicIntroPlaylists.js','VerifyPreparedHeatMusicPlaylist.js','MeasurePlanLoudness.js','FrostyGplManager.js','HeatMusicV5LayeredOverlay.js','HeatFbPack.cs','HeatMusicModManagerPanel.cs','HeatMusicInstallerV3.cs','HeatMusicPlanEditor.cs'
];
fs.mkdirSync(path.join(target,'work'),{recursive:true});
copy(path.join(__dirname,'HeatMusicInstallerV5Beta5.exe'),path.join(target,'HeatMusicInstallerV5Beta5.exe'));
copy(path.join(__dirname,'README-English-V5-Test.txt'),path.join(target,'README.txt'));
copy(path.join(baseline,'runtime','node.exe'),path.join(target,'runtime','node.exe'));
copy(path.join(baseline,'NODE-LICENSE.txt'),path.join(target,'licenses','NODE-LICENSE.txt'));
for(const file of workFiles)copy(path.join(__dirname,file),path.join(target,'work',file));
for(const file of ['ExtractTrustedZip.exe','DecodeOriginalEaForLoudness.exe'])copy(path.join(baseline,'work',file),path.join(target,'work',file));
copy(path.join(__dirname,'HeatTrack24SizeMod.exe'),path.join(target,'work','HeatTrack24SizeMod.exe'));
for(const folder of ['host','shared'])copyTree(path.join(dotnetRoot,folder),path.join(target,'runtime','dotnet8',folder));
copy(path.join(dotnetRoot,'dotnet.exe'),path.join(target,'runtime','dotnet8','dotnet.exe'));
copy(path.join(dotnetRoot,'LICENSE.txt'),path.join(target,'licenses','DOTNET-LICENSE.txt'));
copy(path.join(dotnetRoot,'ThirdPartyNotices.txt'),path.join(target,'licenses','DOTNET-ThirdPartyNotices.txt'));
copyTree(frostBuild,path.join(target,'runtime','frosty-gpl'),(from,entry)=>!entry.name.toLowerCase().endsWith('.pdb')&&entry.name!=='Caches');
copy(path.join(root,'frostysource-current','FrostyCli','ThirdParty','CryptBase.dll'),path.join(target,'runtime','frosty-gpl','CryptBase.dll'));
copy(path.join(root,'frostysource-current','LICENSE'),path.join(target,'licenses','FrostyToolsuite-GPLv3.txt'));
copy(path.join(repo,'frostygpl','0001-heat-compiled-mod-and-windows-links.patch'),path.join(target,'source','frostygpl','0001-heat-compiled-mod-and-windows-links.patch'));
copy(path.join(repo,'frostygpl','README.md'),path.join(target,'source','frostygpl','README.md'));
copyTree(path.join(repo,'frostygpl','FrostyPayloadAudit'),path.join(target,'source','frostygpl','FrostyPayloadAudit'));
copy(path.join(repo,'docs','v5-validation.md'),path.join(target,'docs','v5-validation.md'));
for(const folder of ['direct-track24-ealayer3-all-test','direct-track24-menu-loop-test','direct-track24-menu-lead-loop-test','direct-track24-race-intro-test']){
  const source=path.join(baseline,'output',folder,'manifest.json');if(fs.existsSync(source))copy(source,path.join(target,'output',folder,'manifest.json'));
}
for(const relative of ['output/playlist-placements.json','output/race-intro-track24-test/waves.tsv','output/race-intro-track24-test/all-inventory.tsv']){
  const source=path.join(baseline,relative);if(fs.existsSync(source))copy(source,path.join(target,relative));
}
fs.renameSync(target,finalTarget);
console.log('PORTABLE_PACKAGE_READY '+finalTarget);

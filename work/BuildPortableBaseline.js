// Recreate the tested 19-slot baseline using the user's own NFS Heat files.
// No original game assets are included in a distribution of this script.
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const game=process.argv[2]&&path.resolve(process.argv[2]);
const dataDir=process.argv[3]&&path.resolve(process.argv[3]);
const target=process.argv[4]&&path.resolve(process.argv[4]);
const verifyOnly=process.argv.includes('--verify-only');
const testWorkspace=process.argv.includes('--test-workspace');
const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
function fail(message){throw new Error(message);}
function readJson(name){return JSON.parse(fs.readFileSync(path.join(dataDir,name,'manifest.json'),'utf8'));}
function location(prefix,cas,offset,size){
  const bytes=Buffer.alloc(12);bytes[2]=prefix;bytes[3]=cas;
  bytes.writeUInt32BE(offset,4);bytes.writeUInt32BE(size,8);return bytes;
}
function assertLocation(toc,offset,expected,label){
  if(offset<0||offset+12>toc.length||!toc.subarray(offset,offset+12).equals(expected))
    fail('Versão do jogo incompatível em '+label+' (TOC '+offset+'). Nenhum arquivo foi criado.');
}
function linkEntry(source,dest){
  const stat=fs.statSync(source);
  if(stat.isDirectory())fs.symlinkSync(source,dest,'junction');
  else try{fs.linkSync(source,dest);}catch(error){
    if(!['EXDEV','EPERM','EACCES'].includes(error.code))throw error;
    fs.symlinkSync(source,dest,'file');
  }
}
function cloneAncestors(source,dest,relative='',replacements){
  fs.mkdirSync(dest);
  for(const name of fs.readdirSync(source)){
    const from=path.join(source,name),to=path.join(dest,name);
    const rel=path.join(relative,name).toLowerCase();
    if(replacements.has(rel)){fs.copyFileSync(from,to);continue;}
    if(['win32','win32\\configurations',
      'win32\\configurations\\superbundleinstallpackage',
      'win32\\configurations\\superbundleinstallpackage2'].includes(rel))
      cloneAncestors(from,to,rel,replacements);
    else linkEntry(from,to);
  }
}
function main(){
  if(!game||!dataDir||(!verifyOnly&&!target))
    fail('Uso: node BuildPortableBaseline.js <pasta-jogo> <pasta-metadados> <destino> [--verify-only]');
  const exe=path.join(game,'NeedForSpeedHeat.exe');
  const gameData=path.join(game,'Data');
  const gamePatch=path.join(game,'Patch');
  const tocFile=path.join(gameData,'Win32','chunks0.toc');
  if(!fs.existsSync(exe)||!fs.existsSync(tocFile)||!fs.existsSync(gamePatch))
    fail('Selecione a pasta do NFS Heat com NeedForSpeedHeat.exe, Data e Patch.');
  const five=readJson('direct-track24-ealayer3-all-test');
  const loop=readJson('direct-track24-menu-loop-test');
  const lead=readJson('direct-track24-menu-lead-loop-test');
  const intro=readJson('direct-track24-race-intro-test');
  if(five.placements.length!==5||intro.placements.length!==12)
    fail('Manifestos da versão testada incompletos');
  const original=fs.readFileSync(tocFile),patched=Buffer.from(original);
  const changes=[];
  for(const item of five.placements)changes.push({label:item.name,at:item.tocOffset,
    old:location(1,item.oldCas,item.oldOffset,item.oldSize),
    next:location(1,item.newCas,item.newOffset,item.newSize)});
  for(const [name,item] of [['menu loop',loop],['menu lead',lead]])changes.push({
    label:name,at:item.tocOffset,old:Buffer.from(item.oldLocation,'hex'),
    next:Buffer.from(item.newLocation,'hex')});
  for(const item of intro.placements)changes.push({label:item.assetName,at:item.tocOffset,
    old:location(1,item.oldCas,item.oldOffset,item.oldSize),
    next:location(1,item.newCas,item.newOffset,item.newSize)});
  const seen=new Set();
  for(const item of changes){
    if(seen.has(item.at))fail('TOC duplicado: '+item.at);seen.add(item.at);
    assertLocation(original,item.at,item.old,item.label);
    item.next.copy(patched,item.at);
  }
  if(hash(patched)!==intro.patchedTocSha256)
    fail('Assinatura do TOC não corresponde à versão testada; instalação recusada.');
  const casFiles=[
    ['win32\\configurations\\superbundleinstallpackage2\\cas_08.cas',five.originalCasBytes,intro.finalCas08Bytes],
    ['win32\\configurations\\superbundleinstallpackage\\cas_13.cas',lead.originalCas13Bytes,lead.cas13Bytes],
    ['win32\\configurations\\superbundleinstallpackage\\cas_14.cas',loop.originalCas14Bytes,loop.cas14Bytes]
  ];
  for(const [relative,originalSize,finalSize] of casFiles){
    const file=path.join(gameData,relative);
    if(!fs.existsSync(file)||fs.statSync(file).size!==originalSize||finalSize<originalSize)
      fail('CAS original não corresponde à versão testada: '+relative);
  }
  console.log('BASELINE_COMPATIBLE',changes.length,'slots','TOC',hash(patched));
  if(verifyOnly)return;
  const normalTarget=path.join(game,'ModData','HeatTrack24RaceIntroAudioTest');
  const testTarget=path.join(path.resolve(__dirname,'..'),'output','portable-baseline-test');
  if(target!==normalTarget&&!(testWorkspace&&target===testTarget))
    fail('Destino de baseline inválido');
  if(fs.existsSync(target))fail('Baseline já existe; não será sobrescrito: '+target);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.mkdirSync(target);
  const replacements=new Set(['win32\\chunks0.toc',...casFiles.map(x=>x[0])]);
  cloneAncestors(gameData,path.join(target,'Data'),'',replacements);
  fs.writeFileSync(path.join(target,'Data','Win32','chunks0.toc'),patched);
  for(const [relative,originalSize,finalSize] of casFiles){
    const file=path.join(target,'Data',relative);
    fs.truncateSync(file,finalSize);
    if(fs.statSync(file).size!==finalSize)fail('Falha ao montar '+relative);
  }
  fs.symlinkSync(gamePatch,path.join(target,'Patch'),'junction');
  const gameUpdate=path.join(game,'Update');
  if(fs.existsSync(gameUpdate))fs.symlinkSync(gameUpdate,path.join(target,'Update'),'junction');
  console.log('BASELINE_CREATED',target);
}
try{main();}catch(error){console.error('ERROR:',error.stack||error.message);process.exitCode=1;}

'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
function verifyPackage(root) {
 root=path.resolve(root);const files=[];
 function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  assert(!entry.isSymbolicLink(),'Distribution contains a filesystem link');
  const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else files.push(file);
 }}walk(root);
 for(const file of files){
  const rel=path.relative(root,file);
  assert(!/\.(key|fbmod|fbpack|mp3|flac|wav|ealayer3|cas|sb|toc|heatpreset|log)$/i.test(rel),'Private/game payload in distribution: '+rel);
  assert(!/(?:^|[\\/])(?:Caches|custom-builds|audio-cache-v1|ModData|logs)(?:[\\/])/i.test(rel),'Runtime state in distribution: '+rel);
  if(rel.startsWith('work'+path.sep)&&file.endsWith('.js')){
   const text=fs.readFileSync(file,'utf8');
   for(const match of text.matchAll(/require\(['"](\.\/[^'"]+)['"]\)/g)){
    const target=path.resolve(path.dirname(file),match[1]);
    assert(fs.existsSync(target)||fs.existsSync(target+'.js'),'Missing local module '+match[1]+' in '+rel);
   }
  }
 }
 for(const required of ['HeatMusicInstallerV5Beta7_3.exe','runtime/node.exe','runtime/dotnet8/dotnet.exe','runtime/frosty-gpl/FrostyCli.dll','work/HeatProfileFiles.js','work/HeatModOrder.js','licenses/FrostyToolsuite-GPLv3.txt','README.txt'])
  assert(fs.statSync(path.join(root,required),{throwIfNoEntry:false})?.isFile(),'Missing package component '+required);
 return {files:files.length,bytes:files.reduce((n,f)=>n+fs.statSync(f).size,0)};
}
module.exports={verifyPackage};
if(require.main===module){if(!process.argv[2])throw new Error('Provide the clean package folder');console.log(JSON.stringify(verifyPackage(process.argv[2])));}

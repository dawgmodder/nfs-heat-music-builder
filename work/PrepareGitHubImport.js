// Explicit source-only import. Never enumerate the whole workspace for upload.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const packageCode=fs.readFileSync(path.join(__dirname,'BuildHeatMusicPortablePackage.js'),'utf8');
const block=packageCode.match(/const files=\[([\s\S]*?)\];/)[1];
const files=[...block.matchAll(/'([^']+)'/g)].map(x=>x[1].replace(/\.exe$/,'.cs'));
files.push('HeatMusicInstallerV3.cs','HeatMusicPlanEditor.cs','HeatMusicInstaller.manifest',
 'BuildHeatIcon.cs','BuildHeatMusicPortablePackage.js','compile-v4.ps1','compile-size-mod.ps1',
 'compile-size-apply.ps1','compile-decode-original.ps1','README-English.txt',
 'TestV4Ui.cs','test-v4.ps1','TestV327.js','PrepareGitHubImport.js');
const target=path.join(root,'github-source-import');
if(fs.existsSync(target))throw Error('Import directory already exists');
const entries=[];
for(const name of [...new Set(files)].sort()){
 if(!/^[\w.-]+\.(js|cs|ps1|txt|manifest)$/.test(name))throw Error('Unsafe source name '+name);
 const content=fs.readFileSync(path.join(__dirname,name),'utf8');
 const patterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bgh[pousr]_[A-Za-z0-9]{20,}/,/github_pat_[A-Za-z0-9_]{20,}/,/\bAKIA[A-Z0-9]{16}\b/];
 if(content.includes('\0')||patterns.some(p=>p.test(content)))throw Error('Sensitive/binary content requires review: '+name);
 entries.push({path:'work/'+name,content,sha256:crypto.createHash('sha256').update(content).digest('hex')});
}
fs.mkdirSync(path.join(target,'work'),{recursive:true});
for(const entry of entries)fs.copyFileSync(path.join(root,entry.path),path.join(target,entry.path));
console.log(JSON.stringify({target,count:entries.length,bytes:entries.reduce((n,x)=>n+Buffer.byteLength(x.content),0),files:entries.map(({path,sha256})=>({path,sha256}))},null,2));

'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert'),crypto=require('crypto');
const {prepare,targets}=require('./HeatGarageStreamProbe');
const {locateChunk,readLocation}=require('./HeatMusicCasAddress');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'heat-garage-probe-test-'));
const source=path.join(root,'ModData/source'),dest=path.join(root,'ModData/probe');
for(const layer of ['Data','Patch'])fs.mkdirSync(path.join(source,layer,'Win32/testcatalog'),{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function variable(n){const bytes=[];do{const b=n&127;n=Math.floor(n/128);bytes.push(b|(n?128:0));}while(n);return Buffer.from(bytes);}
function field(type,name,body){return Buffer.concat([Buffer.from([type]),Buffer.from(name+'\0'),body]);}
function container(type,name,children){const body=Buffer.concat([...children,Buffer.from([0])]);return field(type,name,Buffer.concat([variable(body.length),body]));}
const layout=container(2,'',[container(2,'installManifest',[container(1,'installChunks',[container(2,'',[field(8,'persistentIndex',Buffer.alloc(4)),field(7,'installBundle',Buffer.concat([variable(18),Buffer.from('Win32/testcatalog\0')]))])])])]);
fs.writeFileSync(path.join(source,'Patch/layout.toc'),layout);
const toc=Buffer.alloc(668),at=604,locStart=644;
toc.writeUInt32BE(at-556,572);toc.writeUInt32BE(2,576);toc.writeUInt32BE(locStart-556,580);
for(let i=0;i<2;i++){
 const g=Buffer.from(targets[i].replaceAll('-',''),'hex');g.subarray(0,4).reverse();g.subarray(4,6).reverse();g.subarray(6,8).reverse();g.reverse().copy(toc,at+i*20);
 toc.writeUInt32BE(i*3,at+i*20+16);toc[locStart+i*12+3]=1;toc.writeUInt32BE(i*4,locStart+i*12+4);toc.writeUInt32BE(4,locStart+i*12+8);
}
fs.writeFileSync(path.join(source,'Data/Win32/chunks1.toc'),toc);
fs.writeFileSync(path.join(source,'Data/Win32/testcatalog/cas_01.cas'),Buffer.from('oldAoldB'));
fs.writeFileSync(path.join(source,'Patch/Win32/testcatalog/cas_02.cas'),Buffer.from('newAnewB'));
const report={summary:{profile:source,errors:0},garagePayloads:targets.map((guid,i)=>({type:3,name:guid,matches:true,sha256:hash(Buffer.from(i?'newB':'newA')),expected:hash(Buffer.from(i?'newB':'newA')),loc:{patch:true,catalog:0,cas:2,offset:i*4,size:4}}))};
const plan=prepare(source,dest,report,false);assert.equal(plan.created,false);assert(!fs.existsSync(dest));
assert.throws(()=>prepare(source,dest,{...report,summary:{...report.summary,errors:1}},true));assert(!fs.existsSync(dest));
const corrupt=structuredClone(report);corrupt.garagePayloads[0].expected='0'.repeat(64);
assert.throws(()=>prepare(source,dest,corrupt,true),/Source changed/);assert(!fs.existsSync(dest));
const conflict=structuredClone(report);conflict.garagePayloads.push({...conflict.garagePayloads[0],sha256:'f'.repeat(64)});
assert.throws(()=>prepare(source,dest,conflict,true),/Conflicting/);assert(!fs.existsSync(dest));
const done=prepare(source,dest,report,true);assert(done.created);assert.deepEqual(fs.readFileSync(path.join(source,'Data/Win32/chunks1.toc')),toc);
const changed=fs.readFileSync(path.join(dest,'Data/Win32/chunks1.toc'));
for(const guid of targets)assert(readLocation(changed,locateChunk(changed,guid)).patch);
assert.equal(fs.statSync(path.join(dest,'Data/Win32/chunks1.toc')).nlink,1);
assert.throws(()=>prepare(source,dest,report,true),/already exists/);
console.log('PASS: dry run, invalid audit, stale bytes, conflicting payloads, isolated creation, no overwrite (6 checks).');
console.log('Temporary fixture retained:',root);

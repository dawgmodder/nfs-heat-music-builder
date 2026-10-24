'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert');
const productionDir=process.env.HEAT_PROFILE_TEST_WORK || __dirname;
const {materializeTree,validateProfileTree,publishProfile,validateGameFileCoverage}=require(path.join(productionDir,'HeatProfileFiles'));
const root=fs.mkdtempSync(path.join(os.tmpdir(),'heat-profile-regression-'));
const at=name=>path.join(root,name);
function fixture(name){const dir=at(name);fs.mkdirSync(path.join(dir,'Win32','loc'),{recursive:true});fs.mkdirSync(path.join(dir,'Win32','levels'));fs.writeFileSync(path.join(dir,'Win32','loc','en.toc'),'english');fs.writeFileSync(path.join(dir,'Win32','loc','en.sb'),'');fs.writeFileSync(path.join(dir,'Win32','levels','frontend.toc'),'level');return dir;}
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
test('materialized Data survives removal of source and publication',()=>{
 const staging=at('staging');fs.mkdirSync(staging);
 const source=fixture('staging/Data');const candidate=at('staging/Data.new');
 materializeTree(source,candidate);
 fs.rmSync(source,{recursive:true});fs.renameSync(candidate,source);
 publishProfile(staging,at('published'),at('backup'));
 assert.equal(fs.readFileSync(at('published/Data/Win32/loc/en.toc'),'utf8'),'english');
 assert.equal(validateProfileTree(at('published')).links,0);
});
test('source junction is resolved; resulting tree has no directory links',()=>{
 const original=fixture('original');fs.symlinkSync(original,at('source-junction'),'junction');
 materializeTree(at('source-junction'),at('materialized'));
 assert.equal(validateProfileTree(at('materialized')).links,0);
 assert.equal(fs.statSync(at('materialized/Win32/loc/en.sb')).size,0);
});
test('cross-volume fallback copies complete bytes',()=>{
 const original=fs.linkSync;fs.linkSync=()=>{const e=new Error('cross device');e.code='EXDEV';throw e;};
 try {materializeTree(at('original'),at('copied'));}finally{fs.linkSync=original;}
 assert.equal(fs.readFileSync(at('copied/Win32/loc/en.toc'),'utf8'),'english');
});
test('dangling language link is rejected before replacing current profile',()=>{
 const bad=at('bad');fs.mkdirSync(bad);fs.symlinkSync(at('missing'),path.join(bad,'loc'),'junction');
 const current=fixture('current');assert.throws(()=>publishProfile(bad,current,at('current.previous')),/Unreadable/);
 assert.equal(fs.readFileSync(path.join(current,'Win32/loc/en.toc'),'utf8'),'english');
});
test('live staging directory links are rejected before rename',()=>{
 const bad=fixture('internal');fs.symlinkSync(path.join(bad,'Win32/loc'),path.join(bad,'alias'),'junction');
 assert.throws(()=>validateProfileTree(bad),/temporary\/profile/);
});
test('post-publication validation failure restores previous and preserves candidate',()=>{
 const staged=fixture('rollback-stage'),current=fixture('rollback-current');
 fs.writeFileSync(path.join(current,'old.txt'),'previous');let calls=0;
 assert.throws(()=>publishProfile(staged,current,at('rollback-backup'),(dir,forbidden)=>{
  calls++;if(calls===2)throw new Error('injected final failure');return validateProfileTree(dir,forbidden);
 }),/injected final/);
 assert.equal(calls,2);assert(fs.existsSync(path.join(current,'old.txt')));assert(fs.existsSync(staged));
});
test('cycles are rejected when materializing',()=>{
 const dir=fixture('cycle');fs.symlinkSync(dir,path.join(dir,'back'),'junction');
 assert.throws(()=>materializeTree(dir,at('cycle-copy')),/cycle/);
});
test('manager and portable package integrate production helpers',()=>{
 assert(fs.readFileSync(path.join(productionDir,'FrostyGplManager.js'),'utf8').includes('publishProfile(staging, modData, previous,'));
 assert(fs.readFileSync(path.join(productionDir,'HeatMusicV5LayeredOverlay.js'),'utf8').includes('materializeTree(source, temporary)'));
 assert(fs.readFileSync(path.join(__dirname,'BuildV5PortablePackage.js'),'utf8').includes("'HeatProfileFiles.js'"));
});
test('missing language directory fails game-file coverage even without a dangling link',()=>{
 fs.mkdirSync(at('game-fixture'));fixture('game-fixture/Data');fixture('game-fixture/Patch');
 materializeTree(at('game-fixture'),at('coverage'));
 assert.equal(validateGameFileCoverage(at('coverage'),at('game-fixture')),6);
 fs.renameSync(at('coverage/Data/Win32/loc'),at('removed-loc'));
 assert.throws(()=>validateGameFileCoverage(at('coverage'),at('game-fixture')),/Required game file/);
});
console.log(`${passed} tests passed. Fixtures preserved: ${root}`);

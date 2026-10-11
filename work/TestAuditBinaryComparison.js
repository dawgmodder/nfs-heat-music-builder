'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const {normalized}=require('./CompareAuditBinaries');
const root=path.resolve(__dirname,'../output');
const rebuilt=path.join(root,'security-audit-v4-1/rebuilt');
let n=0;
for(const file of fs.readdirSync(rebuilt).filter(x=>x.endsWith('.exe'))){
  const a=fs.readFileSync(path.join(root,'HeatMusicPortableV4_1_Distribution',file==='HeatMusicInstallerV4.exe'?'':'work',file));
  const b=fs.readFileSync(path.join(rebuilt,file));
  assert(normalized(a).equals(normalized(b)),file);
  // Test an alteration to the first section's raw data, outside metadata fields.
  const pe=a.readUInt32LE(0x3c),section=pe+24+a.readUInt16LE(pe+20);
  const raw=a.readUInt32LE(section+20),changed=Buffer.from(a);changed[raw]^=1;
  assert(!normalized(a).equals(normalized(changed)),file+' mutated section accepted');
  const appended=Buffer.concat([a,Buffer.from('unexpected-overlay')]);
  assert(!normalized(a).equals(normalized(appended)),file+' appended data accepted');
  assert.throws(()=>normalized(a.subarray(0,64)));
  n+=4;
}
console.log('PASS',n,'binary provenance checks (not an antivirus test)');

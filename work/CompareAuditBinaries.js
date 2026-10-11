'use strict';
// Compare every byte except COFF build time, the sole metadata GUID (MVID),
// and the legacy C# compiler's PrivateImplementationDetails type-name GUID.
// This is a provenance aid, not malware scanning or a safety certificate.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
function normalized(input){
  const b=Buffer.from(input),pe=b.readUInt32LE(0x3c);
  if(b.toString('ascii',pe,pe+4)!=='PE\0\0')throw Error('Not PE');
  const count=b.readUInt16LE(pe+6),size=b.readUInt16LE(pe+20),opt=pe+24;
  const magic=b.readUInt16LE(opt);
  if(![0x10b,0x20b].includes(magic))throw Error('Unknown optional header');
  function offset(rva){
    for(let i=0;i<count;i++){
      const s=opt+size+i*40,start=b.readUInt32LE(s+12),length=b.readUInt32LE(s+16);
      if(rva>=start&&rva<start+length)return b.readUInt32LE(s+20)+rva-start;
    }throw Error('RVA outside raw sections');
  }
  const cli=offset(b.readUInt32LE(opt+(magic===0x20b?112:96)+14*8));
  const meta=offset(b.readUInt32LE(cli+8));
  if(b.readUInt32LE(meta)!==0x424a5342)throw Error('Missing CLR metadata');
  let at=(meta+16+b.readUInt32LE(meta+12)+3)&~3;
  const streams=b.readUInt16LE(at+2);at+=4;
  let guid,strings;
  for(let i=0;i<streams;i++){
    const start=meta+b.readUInt32LE(at),length=b.readUInt32LE(at+4);
    const end=b.indexOf(0,at+8);if(end<0)throw Error('Invalid metadata stream');
    const name=b.toString('ascii',at+8,end);
    if(name==='#GUID'){if(length!==16)throw Error('Expected one metadata GUID');guid=start;}
    if(name==='#Strings')strings={start,length};
    at=(end+4)&~3;
  }
  if(guid===undefined||guid+16>b.length)throw Error('Missing GUID');
  if(!strings||strings.start+strings.length>b.length)throw Error('Missing strings heap');
  const heap=b.toString('latin1',strings.start,strings.start+strings.length);
  const pattern=/\x00<PrivateImplementationDetails>\{([0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12})\}\x00/g;
  const matches=[...heap.matchAll(pattern)];
  if(matches.length>1)throw Error('Ambiguous compiler generated type');
  if(matches.length){const m=matches[0],start=strings.start+m.index+m[0].indexOf(m[1]);b.fill(0,start,start+36);}
  b.fill(0,pe+8,pe+12);b.fill(0,guid,guid+16);
  return b;
}
function main(){
  const root=path.resolve(__dirname,'..'),dir=path.join(root,'output','security-audit-v4-1');
  const rebuilt=path.join(dir,'rebuilt'),pack=path.join(root,'output','HeatMusicPortableV4_1_Distribution');
  const result=fs.readdirSync(rebuilt).filter(n=>n.endsWith('.exe')).map(name=>{
    const original=fs.readFileSync(path.join(pack,name==='HeatMusicInstallerV4.exe'?'':'work',name));
    const fresh=fs.readFileSync(path.join(rebuilt,name));
    const a=normalized(original),b=normalized(fresh);
    let differences=Math.abs(a.length-b.length);
    for(let i=0;i<Math.min(a.length,b.length);i++)if(a[i]!==b[i])differences++;
    if(process.argv.includes('--details')&&differences){
      const positions=[];for(let i=0;i<Math.min(a.length,b.length);i++)if(a[i]!==b[i])positions.push(i);
      console.error(name,positions.map(i=>i.toString(16)).join(','));
      for(const i of positions.filter((x,i,all)=>i===0||x>all[i-1]+8))console.error(i.toString(16),a.subarray(i-40, i+64).toString('ascii'),b.subarray(i-40,i+64).toString('ascii'));
    }
    return {file:name,identical:original.equals(fresh),equalExceptDocumentedCompilerFields:a.equals(b),differentBytes: differences,normalizedSHA256:crypto.createHash('sha256').update(b).digest('hex')};
  });
  fs.writeFileSync(path.join(dir,'binary-comparison.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
}
if(require.main===module)main();
module.exports={normalized};

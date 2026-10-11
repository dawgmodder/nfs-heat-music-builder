// Read the Frosty encryption key from the user's own compatible NFS Heat executable.
// The key itself is never shipped with the installer or printed to a log.
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const paths=require('./HeatMusicPaths');
const exeFile=path.join(paths.game,'NeedForSpeedHeat.exe');
const keyFile=path.join(paths.frostyRuntime,'NFSHEAT.key');
const expectedKeyHash='a1b9d3ec7da083e46a994f43bbc01253c3c974ba5195df0c6af6da4fe837d185';
const knownExeHash='573f91d6984b5dcfbbeacc7ef92ca2d89b46a76b328d71411747b17cd187106c';
const knownOffset=69083632;
const before=Buffer.from('1700000017000000903f1e44010000000000000000000000b0371e440100000001000000000000000000803f0000004000000000000000000000000000000000','hex');
const after=Buffer.from('48be4543010000000100000000000000d8bb454301000000dcbb454301000000e0bb454301000000e4bb454301000000e8bb454301000000ecbb454301000000','hex');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function main(){
  if(!fs.existsSync(exeFile))throw new Error('NeedForSpeedHeat.exe não encontrado em '+paths.game);
  if(fs.existsSync(keyFile)){
    if(sha(fs.readFileSync(keyFile))===expectedKeyHash){console.log('GAME_KEY_READY existing');return;}
    throw new Error('NFSHEAT.key existente não corresponde à versão testada; não será substituído.');
  }
  const exe=fs.readFileSync(exeFile);
  let offset;
  if(sha(exe)===knownExeHash)offset=knownOffset;
  else {
    const match=exe.indexOf(before);
    if(match<0||exe.indexOf(before,match+1)>=0)
      throw new Error('Versão do executável desconhecida: assinatura da chave ausente ou ambígua.');
    offset=match+before.length;
  }
  if(offset<before.length||offset+16+after.length>exe.length||
      !exe.subarray(offset-before.length,offset).equals(before)||
      !exe.subarray(offset+16,offset+16+after.length).equals(after))
    throw new Error('Assinatura local da chave incompatível; extração recusada.');
  const key=exe.subarray(offset,offset+16);
  if(sha(key)!==expectedKeyHash)
    throw new Error('Chave extraída não corresponde à versão testada do NFS Heat.');
  fs.writeFileSync(keyFile,key,{flag:'wx'});
  console.log('GAME_KEY_READY extracted-from-owned-game');
}
try{main();}catch(error){console.error('ERROR:',error.message);process.exitCode=1;}

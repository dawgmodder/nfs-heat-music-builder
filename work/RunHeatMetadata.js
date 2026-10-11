// Frosty's first index scan can emit more than spawnSync's pipe buffer allows.
// Stream both channels directly to files, retaining only a bounded error tail.
const fs=require('fs'),path=require('path');
const {spawnSync}=require('child_process');
const {checkCancellation}=require('./HeatMusicCancellation');
function tail(file){
  const fd=fs.openSync(file,'r');
  try{const size=fs.fstatSync(fd).size,bytes=Buffer.alloc(Math.min(size,4096));
    fs.readSync(fd,bytes,0,bytes.length,Math.max(0,size-bytes.length));
    return bytes.toString('utf8').trim();
  }finally{fs.closeSync(fd);}
}
function runMetadata(executable,args,options={}){
  checkCancellation();
  const output=path.resolve(args[2]);
  if(fs.existsSync(output))throw new Error('Metadata output already exists: '+output);
  const logBase=output+'.'+Date.now()+'-'+process.pid;
  const stdoutLog=logBase+'.stdout.log',stderrLog=logBase+'.stderr.log';
  let stdoutFd,stderrFd,result;
  console.log('METADATA_BEGIN',path.basename(output),'Frosty pode criar o índice na primeira execução.');
  console.log('METADATA_LOGS',stdoutLog,stderrLog);
  try{
    stdoutFd=fs.openSync(stdoutLog,'wx');stderrFd=fs.openSync(stderrLog,'wx');
    result=spawnSync(executable,args,{...options,timeout:options.timeout??600000,
      windowsHide:true,stdio:['ignore',stdoutFd,stderrFd]});
  }finally{
    if(stdoutFd!==undefined)fs.closeSync(stdoutFd);
    if(stderrFd!==undefined)fs.closeSync(stderrFd);
  }
  checkCancellation();
  if(result.error||result.status!==0){
    const error=new Error('Frosty metadata failed: '+String(result.error||('exit '+result.status))+
      '\nLogs: '+stdoutLog+' | '+stderrLog+'\n'+tail(stderrLog)+'\n'+tail(stdoutLog));
    error.code=result.error?.code;error.stdoutLog=stdoutLog;error.stderrLog=stderrLog;
    throw error;
  }
  if(!fs.existsSync(output)||fs.statSync(output).size===0)
    throw new Error('Frosty did not produce metadata: '+output+'; logs: '+stdoutLog+' | '+stderrLog);
  console.log('METADATA_READY',output);
  return {stdoutLog,stderrLog,output};
}
module.exports={runMetadata};

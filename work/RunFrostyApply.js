const fs=require('fs'),path=require('path');
const {spawn}=require('child_process');
function tail(file){
  const fd=fs.openSync(file,'r');
  try{const size=fs.fstatSync(fd).size,b=Buffer.alloc(Math.min(size,4096));
    fs.readSync(fd,b,0,b.length,Math.max(0,size-b.length));return b.toString('utf8');
  }finally{fs.closeSync(fd);}
}
function runFrostyApply(exe,args,{folder,cwd,timeout=1200000,heartbeatMs=10000}={}){
  return new Promise((resolve,reject)=>{
    const prefix=path.join(folder,'frosty-apply-'+Date.now()+'-'+process.pid);
    const stdoutLog=prefix+'.stdout.log',stderrLog=prefix+'.stderr.log';
    let out,err,child,timer,heartbeat,failure,timedOut=false;
    console.log('FROSTY_APPLY_LOGS',stdoutLog,stderrLog);
    try{
      out=fs.openSync(stdoutLog,'wx');err=fs.openSync(stderrLog,'wx');
      child=spawn(exe,args,{cwd,windowsHide:true,stdio:['ignore',out,err]});
    }catch(error){if(out!==undefined)fs.closeSync(out);if(err!==undefined)fs.closeSync(err);reject(error);return;}
    const started=Date.now();
    timer=setTimeout(()=>{timedOut=true;child.kill();},timeout);
    heartbeat=setInterval(()=>{
      try{const lines=tail(stdoutLog).trim().split(/\r?\n/).filter(Boolean);
        console.log('FROSTY_APPLY_PROGRESS',Math.round((Date.now()-started)/1000)+'s',lines.at(-1)||'aguardando saída');
      }catch(error){console.log('FROSTY_APPLY_LOG_WARNING',error.message);}
    },heartbeatMs);
    child.on('error',error=>{failure=error;});
    child.on('close',(code,signal)=>{
      clearTimeout(timer);clearInterval(heartbeat);fs.closeSync(out);fs.closeSync(err);
      if(failure||timedOut||code!==0){
        const error=new Error('Frosty apply failed: '+(timedOut?'ETIMEDOUT':failure||('exit '+code+' signal '+signal))+
          '\nLogs: '+stdoutLog+' | '+stderrLog+'\n'+tail(stderrLog)+'\n'+tail(stdoutLog));
        error.code=timedOut?'ETIMEDOUT':failure?.code;
        reject(error);
      }else resolve({status:code,stdoutLog,stderrLog});
    });
  });
}
module.exports={runFrostyApply};

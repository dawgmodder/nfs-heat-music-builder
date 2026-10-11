// Two-pass dynamic normalization for songs whose peaks forbid simple gain.
const {spawnSync}=require('child_process');
const path=require('path');
module.exports=function normalizeUnsafe(source,wav,ffmpeg){
  const compressor='acompressor=threshold=-24dB:ratio=3:attack=20:release=250,';
  function run(args){
    const result=spawnSync(ffmpeg,args,{encoding:'utf8',windowsHide:true,timeout:180000,
      maxBuffer:8*1024*1024});
    if(result.status!==0)throw new Error('Dynamic normalization failed for '+path.basename(source)+': '+
      String(result.error||result.stderr||result.stdout).slice(-700));
    return result;
  }
  const first=run(['-hide_banner','-nostats','-i',source,'-map','0:a:0','-af',
    compressor+'loudnorm=I=-17.65:TP=-1:LRA=11:print_format=json','-f','null','NUL']);
  const match=first.stderr.match(/\{\s*"input_i"[\s\S]*?\}/);
  if(!match)throw new Error('Dynamic loudness measurements missing: '+source);
  const m=JSON.parse(match[0]);
  for(const key of ['input_i','input_tp','input_lra','input_thresh','target_offset'])
    if(!Number.isFinite(Number(m[key])))throw new Error('Invalid dynamic loudness '+key+': '+source);
  const filter=compressor+'loudnorm=I=-17.65:TP=-1:LRA=11:measured_I='+m.input_i+
    ':measured_TP='+m.input_tp+':measured_LRA='+m.input_lra+
    ':measured_thresh='+m.input_thresh+':offset='+m.target_offset+':linear=false';
  run(['-hide_banner','-loglevel','error','-i',source,'-map','0:a:0','-af',filter,
    '-ar','48000','-ac','2','-c:a','pcm_s16le',wav]);
};

// 3.26: keep digital silence representable by dandev-el3. Do not retry by
// shortening the requested music. ~1 PCM16 LSB of deterministic noise avoids
// empty MP3 granules; disabling the reservoir makes conversion more reliable.
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const {inspectEa}=require('./HeatMusicEaLayer3');
const {checkCancellation}=require('./HeatMusicCancellation');
const POLICY='ea-3.26-silence-safe';
function encodeSegment(input,folder,label,{start=0,seconds,loop=false}={}){
  const paths=require('./HeatMusicPaths');
  if(!Number.isFinite(start)||start<0||!Number.isFinite(seconds)||seconds<=0||
      (seconds+0.1)*48000>0x3fffffff)throw new Error('EA segment outside the 30-bit sample range: '+label);
  fs.mkdirSync(folder,{recursive:true});
  for(const [attempt,padding] of [0,0.012,0.024,0.048].entries()){
    const amplitude=0.00003;
    const base=path.join(folder,label+'-v326-'+attempt),mp3=base+'.mp3',ea=base+'.ealayer3';
    if(fs.existsSync(ea))try{return inspectEa(ea,seconds,0.1);}catch{}
    checkCancellation();
    const args=['-hide_banner','-loglevel','error','-y'];
    if(loop)args.push('-stream_loop','-1');
    args.push('-i',input,'-filter_complex',
      '[0:a:0]atrim=start='+start.toFixed(6)+':duration='+seconds.toFixed(6)+',asetpts=PTS-STARTPTS'+(padding?',apad=pad_dur='+padding:'')+'[a];'+
      'anoisesrc=color=white:sample_rate=48000:amplitude='+amplitude+':seed=326[n];'+
      '[a][n]amix=inputs=2:duration=first:normalize=0[out]',
      '-map','[out]','-map_metadata','-1','-ar','48000','-ac','2','-c:a','libmp3lame',
      '-b:a','160k','-reservoir','0','-write_xing','0','-id3v2_version','0','-write_id3v1','0',mp3);
    const timeout=Math.max(180000,Math.ceil(seconds*150));
    const mp=spawnSync(paths.ffmpeg,args,{windowsHide:true,encoding:'utf8',timeout,maxBuffer:4*1024*1024});
    if(mp.status!==0)throw new Error('MP3 preparation failed: '+String(mp.error||mp.stderr));
    checkCancellation();
    // Only generated candidates owned by this invocation can be replaced.
    if(fs.existsSync(ea))fs.unlinkSync(ea);
    // Some MP3 endings deterministically hang this converter, even at other
    // bitrates. Retry from PCM with a small padded ending, never by cutting
    // music. The original duration tolerance still bounds the final result.
    const result=spawnSync(paths.converter,[mp3],{cwd:paths.converterDir,windowsHide:true,
      encoding:'utf8',timeout:Math.max(15000,Math.ceil(seconds*60)),maxBuffer:1024*1024});
    checkCancellation();
    if(result.status===0&&fs.existsSync(ea)){
      try{const audio=inspectEa(ea,seconds,0.1);
        console.log('ENCODED_SILENCE_SAFE',label,'160k','requested',seconds.toFixed(3),
          'actual',audio.seconds.toFixed(3),'attempt',attempt+1,'endPaddingMs',padding*1000);return audio;
      }catch(error){console.log('EA_RETRY',label,error.message);}
    }else console.log('EA_RETRY',label,'converter exit',result.status,result.error?.code||'',
      'endPaddingMs',padding*1000,'next attempt changes the MP3 ending; no music is trimmed');
  }
  throw new Error('EA conversion failed without shortening the music: '+label);
}
module.exports={encodeSegment,POLICY};

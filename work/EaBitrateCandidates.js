// The EA converter can truncate or hang on some long MP3s. Preserve the
// proven 160 kb/s path for ordinary songs, then retry lower rates before trim.
const rates=[160,144,128,112,96];
module.exports=function bitrateCandidates(seconds){
  if(!Number.isFinite(seconds)||seconds<=0)
    throw new Error('Invalid segment duration: '+seconds);
  const first=seconds>320?2:seconds>280?1:0;
  return rates.slice(first,Math.min(first+4,rates.length));
};

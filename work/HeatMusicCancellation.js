const fs=require('fs');

const flag=process.env.HEAT_MUSIC_CANCEL_FILE;

function checkCancellation(){
  if(!flag||!fs.existsSync(flag))return;
  fs.writeSync(1,'CANCELLED_AT_SAFE_POINT\n');
  process.exit(2);
}

module.exports={checkCancellation};

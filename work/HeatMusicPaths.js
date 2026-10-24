const path=require('path');
const root=path.resolve(__dirname,'..');
const fromEnv=(name,fallback)=>process.env[name]&&path.resolve(process.env[name])||fallback;
const game=fromEnv('HEAT_MUSIC_GAME',
  'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Need for Speed Heat');
const ffmpeg=fromEnv('HEAT_MUSIC_FFMPEG',path.join(root,'runtime','tools','ffmpeg.exe'));
const ffprobe=fromEnv('HEAT_MUSIC_FFPROBE',path.join(root,'runtime','tools','ffprobe.exe'));
const converter=fromEnv('HEAT_MUSIC_CONVERTER',
  path.join(root,'runtime','tools','dandev-el3.exe'));
const frostyRuntime=fromEnv('HEAT_MUSIC_FROSTY_RUNTIME',
  path.join(root,'runtime','FrostyEditor'));
const baseline=fromEnv('HEAT_MUSIC_BASELINE',path.join(root,'output','portable-baseline'));
module.exports={root,game,ffmpeg,ffprobe,converter,converterDir:path.dirname(converter),frostyRuntime,baseline};

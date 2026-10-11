const path=require('path');
const root=path.resolve(__dirname,'..');
const fromEnv=(name,fallback)=>process.env[name]&&path.resolve(process.env[name])||fallback;
const game=fromEnv('HEAT_MUSIC_GAME',
  'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Need for Speed Heat');
const ffmpeg=fromEnv('HEAT_MUSIC_FFMPEG','C:\\Program Files\\Krita (x64)\\bin\\ffmpeg.exe');
const ffprobe=fromEnv('HEAT_MUSIC_FFPROBE','C:\\Program Files\\Krita (x64)\\bin\\ffprobe.exe');
const converter=fromEnv('HEAT_MUSIC_CONVERTER',
  path.join(root,'output','ealayer3-track24-test','converter','dandev-el3.exe'));
const frostyRuntime=fromEnv('HEAT_MUSIC_FROSTY_RUNTIME',
  path.join(process.env.LOCALAPPDATA||'C:\\Users\\WIN10\\AppData\\Local',
    'HeatMusicReplacer','Runtime'));
module.exports={root,game,ffmpeg,ffprobe,converter,converterDir:path.dirname(converter),frostyRuntime};

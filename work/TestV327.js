const fs=require('fs'),path=require('path'),assert=require('assert');
const timing=require('./HeatMusicTiming');
for(const marker of [17.7,29.5,49.9,52,599]){
  const start=timing.raceStart(marker);
  assert.strictEqual(start+timing.RACE_START_LEAD_SECONDS,marker);
  assert.strictEqual(start,marker-1);
}
for(const marker of [NaN,Infinity,-1,0])assert.throws(()=>timing.raceStart(marker));
const base=fs.readFileSync(path.join(__dirname,'HeatMusicBuilder.js'),'utf8');
const intro=fs.readFileSync(path.join(__dirname,'HeatMusicIntroPlaylistBuilder.js'),'utf8');
assert.strictEqual((base.match(/HeatMusicTiming/g)||[]).length,3);
assert(intro.includes("dropDaySeconds:Number(config.introDrops[lists.day[0]])"));
assert(intro.includes("return require('./HeatMusicTiming').raceStart(n)"));
console.log('PASS timing values, invalid markers, production caller wiring (static)');

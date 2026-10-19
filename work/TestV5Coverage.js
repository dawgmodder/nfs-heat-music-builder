const assert=require('assert'),fs=require('fs'),path=require('path');
const {assertFullCoverage,expectedResources}=require('./HeatMusicCoverage');
const rows=expectedResources().map((x,i)=>({name:x.name,chunkId:x.guid||`00000000-0000-0000-0000-${String(i).padStart(12,'0')}`}));
const manifest={placements:rows.slice(0,192),patchAudio:rows[192],patchExtras:rows.slice(193)};
assert.equal(assertFullCoverage(manifest).playlistSlots,71);
assert.throws(()=>assertFullCoverage({placements:rows.slice(0,19)}),/Incomplete soundtrack coverage/);
const bad=structuredClone(manifest);bad.placements[1]=bad.placements[0];
assert.throws(()=>assertFullCoverage(bad),/Duplicate/);
const wrong=structuredClone(manifest);wrong.placements[0].chunkId='bad-guid';
assert.throws(()=>assertFullCoverage(wrong),/incorrect soundtrack slot/);
const vs=structuredClone(manifest);vs.placements.find(x=>x.name.includes('/VS_')).name='missing-loading-track';
assert.throws(()=>assertFullCoverage(vs),/incorrect soundtrack slot/);
// Both auto-analysis and edited/preset plans must use the same full builder.
const planner=fs.readFileSync(path.join(__dirname,'HeatMusicAutoPlanner.js'),'utf8');
assert(!planner.includes('HeatMusicSingleTrackV41Builder'));
assert.equal(planner.split("path.join(__dirname,'HeatMusicIntroPlaylistBuilder.js')").length-1,2);
console.log('PASS full coverage: 199 identities / 71 playlist slots, partial build, duplicates, wrong GUID, missing loading track, both planner routes.');

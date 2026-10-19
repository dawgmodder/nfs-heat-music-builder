'use strict';
const fs=require('fs'),path=require('path');
function expectedResources(root=path.resolve(__dirname,'..')) {
  const playlist=JSON.parse(fs.readFileSync(path.join(root,'output/playlist-placements.json'),'utf8'));
  const intros=fs.readFileSync(path.join(root,'output/race-intro-track24-test/all-inventory.tsv'),'utf8').trim().split(/\r?\n/).slice(1)
    .map(line=>{const fields=line.split('\t');return {name:fields[4],guid:fields[5]};});
  const menu=['Roboto_Bootflow_LeadIn_Underground','Roboto_Bootflow_Loop_Underground']
    .map(name=>({name:'Audio/Music/Roboto/LoadingScreen_Music/'+name}));
  if(playlist.length!==71||intros.length!==126)throw Error('Incomplete soundtrack inventory');
  const result=[...playlist,...intros,...menu];
  if(new Set(result.map(x=>x.name.toLowerCase())).size!==199)throw Error('Duplicate soundtrack inventory');
  return result;
}
function assertFullCoverage(manifest,root) {
  const data=manifest.placements||[],patch=[manifest.patchAudio,...(manifest.patchExtras||[])].filter(Boolean);
  if(data.length!==192||patch.length!==7)
    throw Error(`Incomplete soundtrack coverage: ${data.length} Data + ${patch.length} Patch; rebuild with full playlists (192 + 7 required, even for one song).`);
  const rows=[...data,...patch],byName=new Map(rows.map(x=>[String(x.name).toLowerCase(),x]));
  if(byName.size!==199||new Set(rows.map(x=>String(x.chunkId).toLowerCase())).size!==199)
    throw Error('Duplicate soundtrack resource name or GUID');
  for(const expected of expectedResources(root)) {
    const row=byName.get(expected.name.toLowerCase());
    if(!row||(expected.guid&&String(row.chunkId).toLowerCase()!==expected.guid.toLowerCase()))
      throw Error('Missing or incorrect soundtrack slot: '+expected.name);
  }
  return {resources:199,playlistSlots:71,introSegments:126,menuSegments:2};
}
module.exports={assertFullCoverage,expectedResources};

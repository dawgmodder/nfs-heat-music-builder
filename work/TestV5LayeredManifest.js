'use strict';
const fs = require('fs');
const path = require('path');

const buildDir = path.resolve(process.argv[2] || '');
const manifestFile = path.join(buildDir, 'manifest.json');
if (!fs.statSync(manifestFile, { throwIfNoEntry: false })?.isFile())
  throw new Error('Usage: node TestV5LayeredManifest.js <prepared-build>');
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
if (manifest.frostyPayloadMode !== 'metadata-with-layered-audio-overlay')
  throw new Error('Build is not configured for layered audio');
const patch = [manifest.patchAudio, ...(manifest.patchExtras || [])].filter(Boolean);
const fullBuild=manifest.placements?.length===192&&patch.length===7;
const isolatedV41=manifest.compatibilityMode==='v41-isolated-contexts'&&
  manifest.placements?.length===19&&patch.length===0&&manifest.metadataFile==='metadata.fbmod';
if (!fullBuild&&!isolatedV41) throw new Error(`Unsupported layout: ${manifest.placements?.length} Data + ${patch.length} Patch`);
const playlist = [...manifest.placements, ...patch].filter(item => /[\\/]Playlist[\\/]/i.test(item.name));
if (fullBuild&&playlist.length !== 71) throw new Error(`Expected 71 playlist slots, got ${playlist.length}`);
for (const item of [...manifest.placements, ...patch]) {
  if (!Number.isFinite(item.seconds) || item.seconds <= 0 || !Number.isInteger(item.audioBytes) || item.audioBytes <= 0 ||
      !/^[0-9a-f]{64}$/i.test(item.audioSha256 || '')) throw new Error(`Invalid audio metadata: ${item.name}`);
}
const uniquePlaylistAudio = new Set(playlist.map(item => item.audioSha256));
console.log(JSON.stringify({ buildId: manifest.id, mode:isolatedV41?'v41-isolated-contexts':'full',
  data:manifest.placements.length,patch:patch.length,playlistSlots:playlist.length,
  uniquePlaylistAudio: uniquePlaylistAudio.size }));

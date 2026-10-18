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
if (manifest.placements?.length !== 192) throw new Error(`Expected 192 Data placements, got ${manifest.placements?.length}`);
const patch = [manifest.patchAudio, ...(manifest.patchExtras || [])].filter(Boolean);
if (patch.length !== 7) throw new Error(`Expected 7 Patch placements, got ${patch.length}`);
const playlist = [...manifest.placements, ...patch].filter(item => /[\\/]Playlist[\\/]/i.test(item.name));
if (playlist.length !== 71) throw new Error(`Expected 71 playlist slots, got ${playlist.length}`);
for (const item of [...manifest.placements, ...patch]) {
  if (!Number.isFinite(item.seconds) || item.seconds <= 0 || !Number.isInteger(item.audioBytes) || item.audioBytes <= 0 ||
      !/^[0-9a-f]{64}$/i.test(item.audioSha256 || '')) throw new Error(`Invalid audio metadata: ${item.name}`);
}
const uniquePlaylistAudio = new Set(playlist.map(item => item.audioSha256));
console.log(JSON.stringify({ buildId: manifest.id, data: 192, patch: 7, playlistSlots: 71,
  uniquePlaylistAudio: uniquePlaylistAudio.size }));

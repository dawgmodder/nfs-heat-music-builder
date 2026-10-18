'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { runMetadata } = require('./RunHeatMetadata');

function sha(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function link(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try { fs.linkSync(source, target); }
  catch (error) {
    if (!['EXDEV', 'EPERM', 'EACCES'].includes(error.code)) throw error;
    fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
  }
}
function linkTree(source, target) {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name), to = path.join(target, entry.name);
    if (entry.isDirectory()) linkTree(from, to); else if (entry.isFile()) link(from, to);
  }
}
function main() {
  const source = path.resolve(process.argv[2] || '');
  const target = path.resolve(process.argv[3] || '');
  const game = path.resolve(process.argv[4] || process.env.HEAT_MUSIC_GAME || '');
  if (!fs.existsSync(path.join(source, 'manifest.json')) || fs.existsSync(target))
    throw new Error('Usage: node PrepareV5Beta4RegressionBuild.js <source-build> <new-build> <game> (target must not exist)');
  fs.mkdirSync(target, { recursive: false });
  for (const name of ['chunks0.toc', 'cas_08.cas', 'cas_13.cas', 'cas_14.cas', 'waves.tsv',
    'playlist-patch.ealayer3', 'playlist-patch-chunks0.toc']) link(path.join(source, name), path.join(target, name));
  linkTree(path.join(source, 'audio'), path.join(target, 'audio'));
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8'));
  manifest.id = path.basename(target);
  manifest.frostyPayloadMode = 'metadata-with-layered-audio-overlay';
  manifest.sourceDataTocSha256 = sha(path.join(game, 'Data', 'Win32', 'chunks0.toc'));
  for (const item of manifest.placements) item.layer = 'Data';
  if (manifest.patchAudio) manifest.patchAudio.layer = 'Patch';
  for (const item of manifest.patchExtras || []) item.layer = 'Patch';
  manifest.metadataFile = 'intro-playlist-metadata.fbmod';
  fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2));
  runMetadata(path.join(__dirname, 'HeatTrack24SizeMod.exe'), ['dynamicallintro', path.join(target, 'waves.tsv'),
    path.join(target, manifest.metadataFile)], { cwd: path.resolve(__dirname, '..') });
  const exports = path.join(path.resolve(__dirname, '..'), 'output', 'exports');
  fs.mkdirSync(exports, { recursive: true });
  const exported = path.join(exports, `NFSHeatCustomSoundtrack_${manifest.id}.fbmod`);
  fs.copyFileSync(path.join(target, manifest.metadataFile), exported, fs.constants.COPYFILE_EXCL);
  console.log('REGRESSION_BUILD_READY', target);
  console.log('REGRESSION_FBMOD_READY', exported);
}
if (require.main === module) try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }

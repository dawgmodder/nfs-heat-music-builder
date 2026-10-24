'use strict';

// NFS Heat Music Builder - Frosty GPL orchestration layer.
// This file is part of the GPLv3 Frosty integration and is distributed under GPLv3-or-later.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { applyLayeredOverlay } = require('./HeatMusicV5LayeredOverlay');
const { publishProfile, validateProfileTree, validateGameFileCoverage } = require('./HeatProfileFiles');

let signalCancellation = false;
let cleanupStaging = null;
let logFile = null;
process.on('SIGINT', () => { signalCancellation = true; });
process.on('SIGTERM', () => { signalCancellation = true; });

function emit(type, detail = {}) {
  const line = `${JSON.stringify({ time: new Date().toISOString(), type, ...detail })}\n`;
  if (logFile) fs.appendFileSync(logFile, line, 'utf8');
  process.stdout.write(line);
}

function assertFile(file, label) {
  if (!file || !path.isAbsolute(file) || !fs.statSync(file, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`${label} is not a readable absolute file: ${file || '<empty>'}`);
  }
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function compatibleCacheKey(source, cli, key, gameExe) {
  const digest = crypto.createHash('sha256');
  for (const file of [source, cli, key, gameExe,
    path.join(path.dirname(gameExe), 'Data', 'layout.toc'),
    path.join(path.dirname(gameExe), 'Patch', 'layout.toc')]) {
    digest.update(path.basename(file).toLowerCase());
    if (fs.statSync(file, { throwIfNoEntry: false })?.isFile()) digest.update(sha256(file));
    else digest.update('<missing>');
  }
  return digest.digest('hex');
}

function isCancelled(config) {
  return signalCancellation || (config.cancelFile && fs.existsSync(config.cancelFile));
}

function checkpoint(config, stage) {
  if (isCancelled(config)) {
    const error = new Error(`Cancelled safely after ${stage}. The active profile was not replaced.`);
    error.cancelled = true;
    throw error;
  }
}

function run(executable, args, cwd, stage) {
  return new Promise((resolve, reject) => {
    emit('stage', { stage });
    const child = spawn(executable, args, { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const forward = stream => stream.on('data', value => emit('log', { stage, message: value.toString().trimEnd() }));
    forward(child.stdout);
    forward(child.stderr);
    child.once('error', reject);
    child.once('exit', code => {
      code === 0 ? resolve() : reject(new Error(`${stage} exited with code ${code}`));
    });
  });
}

async function main() {
  if (process.argv.length !== 3) throw new Error('Usage: node FrostyGplManager.js <config.json>');
  const configPath = path.resolve(process.argv[2]);
  assertFile(configPath, 'Configuration');
  const logDir = path.join(path.dirname(configPath), 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  logFile = path.join(logDir, `manager-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}.log`);
  fs.writeFileSync(logFile, '', { flag: 'wx' });
  emit('log-file', { file: logFile });
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const gameExe = path.resolve(config.gameExe || '');
  const cli = path.resolve(config.frostyCli || '');
  const dotnet = path.resolve(config.dotnet || '');
  const key = path.resolve(config.initFsKey || '');
  const workDir = path.resolve(config.workDir || '');
  const modData = path.resolve(config.modDataDir || '');
  const musicBuildDir = path.resolve(config.musicBuildDir || '');
  const selected = [...(config.mods || []), config.musicMod].filter(Boolean).map(file => path.resolve(file));

  assertFile(gameExe, 'NFS Heat executable');
  assertFile(cli, 'Frosty CLI');
  assertFile(dotnet, '.NET host');
  assertFile(key, 'NFS Heat initfs key');
  assertFile(path.join(musicBuildDir, 'manifest.json'), 'Prepared soundtrack manifest');
  const soundtrackManifest=JSON.parse(fs.readFileSync(path.join(musicBuildDir,'manifest.json'),'utf8'));
  emit('validated-coverage',require('./HeatMusicCoverage').assertFullCoverage(soundtrackManifest,path.resolve(__dirname,'..')));
  if (!selected.length) throw new Error('At least one FBMOD must be selected.');
  selected.forEach((file, index) => assertFile(file, `FBMOD ${index + 1}`));
  if (new Set(selected.map(file => file.toLowerCase())).size !== selected.length) {
    throw new Error('The same FBMOD is selected more than once.');
  }

  const cliDir = path.dirname(cli);
  // Record the exact assembly implementation, not just the CLI wrapper version.
  emit('runtime', { assemblies: Object.fromEntries(['FrostyCli.dll', 'FrostySdk.dll', 'FrostyModSupport.dll']
    .map(name => [name, sha256(path.join(cliDir, name))])) });
  const modsDir = path.join(workDir, 'mods');
  const cacheDir = path.resolve(config.cacheDir || path.join(workDir, 'updated-cache'));
  const modDataParent = path.dirname(modData);
  const relativeDataPath = path.relative(path.dirname(gameExe), modData).replaceAll('\\', '/');
  if (!relativeDataPath || relativeDataPath.startsWith('../') || path.isAbsolute(relativeDataPath)) {
    throw new Error('ModData must be inside the NFS Heat game directory before assembly.');
  }
  const staging = path.join(modDataParent, `.${path.basename(modData)}-building-${process.pid}-${Date.now()}`);
  const previous = `${modData}.previous-${process.pid}-${Date.now()}`;
  cleanupStaging = staging;
  if (fs.existsSync(modsDir)) fs.rmSync(modsDir, { recursive: true, force: true });
  fs.mkdirSync(modsDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.mkdirSync(modDataParent, { recursive: true });
  checkpoint(config, 'validation');
  const updated = [];
  for (let index = 0; index < selected.length; index++) {
    const source = selected[index];
    const cache = path.join(cacheDir, `${compatibleCacheKey(source, cli, key, gameExe)}.fbmod`);
    if (!fs.existsSync(cache)) {
      const temporary = `${cache}.building-${process.pid}`;
      await run(dotnet, [cli, 'update-mod', gameExe, source, '--output', temporary, '--initfs-key', key], cliDir,
        `update-mod:${path.basename(source)}`);
      checkpoint(config, `updating ${path.basename(source)}`);
      fs.renameSync(temporary, cache);
    } else {
      emit('reused', { stage: 'update-mod', file: path.basename(source) });
    }
    const target = path.join(modsDir, `${String(index + 1).padStart(2, '0')}-${path.basename(source)}`);
    fs.copyFileSync(cache, target);
    updated.push(target);
    checkpoint(config, `preparing ${path.basename(source)}`);
  }

  fs.writeFileSync(path.join(modsDir, 'load_order.json'), JSON.stringify(updated, null, 2));
  await run(dotnet, [cli, 'mod', gameExe, modsDir, staging, '--initfs-key', key], cliDir, 'apply-mods');
  checkpoint(config, 'Frosty apply');
  for (const required of ['head.txt', 'mods.json']) {
    assertFile(path.join(staging, required), `Generated ${required}`);
  }
  if (!fs.statSync(path.join(staging, 'Patch'), { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error('Generated profile has no Patch directory.');
  }
  emit('stage', { stage: 'install-layered-music-audio' });
  const overlay = applyLayeredOverlay({ staging, buildDir: musicBuildDir, gameRoot: path.dirname(gameExe) });
  emit('validated-audio', overlay);
  checkpoint(config, 'layered music audio validation');
  emit('validated', { staging });
  const profileFiles = publishProfile(staging, modData, previous, (root, forbidden) => ({
    ...validateProfileTree(root, forbidden),
    requiredGameFiles: validateGameFileCoverage(root, path.dirname(gameExe))
  }));
  cleanupStaging = null;
  emit('validated-profile-files', profileFiles);
  emit('ready', { modData, launchArguments: ['-dataPath', relativeDataPath] });
}

main().catch(error => {
  try { if (cleanupStaging && fs.existsSync(cleanupStaging)) fs.rmSync(cleanupStaging, { recursive: true, force: true }); } catch {}
  emit('error', { message: error.stack || error.message });
  process.exitCode = error.cancelled ? 2 : 1;
});

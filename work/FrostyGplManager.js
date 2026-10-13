'use strict';

// NFS Heat Music Builder - Frosty GPL orchestration layer.
// This file is part of the GPLv3 Frosty integration and is distributed under GPLv3-or-later.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function emit(type, detail = {}) {
  process.stdout.write(`${JSON.stringify({ type, ...detail })}\n`);
}

function assertFile(file, label) {
  if (!file || !path.isAbsolute(file) || !fs.statSync(file, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`${label} is not a readable absolute file: ${file || '<empty>'}`);
  }
}

function assertDirectory(dir, label) {
  if (!dir || !path.isAbsolute(dir) || !fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`${label} is not a readable absolute directory: ${dir || '<empty>'}`);
  }
}

function run(executable, args, cwd, stage) {
  return new Promise((resolve, reject) => {
    emit('stage', { stage });
    const child = spawn(executable, args, { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const forward = stream => stream.on('data', value => emit('log', { stage, message: value.toString().trimEnd() }));
    forward(child.stdout);
    forward(child.stderr);
    const stop = () => child.kill('SIGTERM');
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    child.once('error', reject);
    child.once('exit', code => {
      process.removeListener('SIGINT', stop);
      process.removeListener('SIGTERM', stop);
      code === 0 ? resolve() : reject(new Error(`${stage} exited with code ${code}`));
    });
  });
}

async function main() {
  if (process.argv.length !== 3) throw new Error('Usage: node FrostyGplManager.js <config.json>');
  const configPath = path.resolve(process.argv[2]);
  assertFile(configPath, 'Configuration');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const gameExe = path.resolve(config.gameExe || '');
  const cli = path.resolve(config.frostyCli || '');
  const dotnet = path.resolve(config.dotnet || '');
  const key = path.resolve(config.initFsKey || '');
  const workDir = path.resolve(config.workDir || '');
  const modData = path.resolve(config.modDataDir || '');
  const selected = [...(config.mods || []), config.musicMod].filter(Boolean).map(file => path.resolve(file));

  assertFile(gameExe, 'NFS Heat executable');
  assertFile(cli, 'Frosty CLI');
  assertFile(dotnet, '.NET host');
  assertFile(key, 'NFS Heat initfs key');
  if (!selected.length) throw new Error('At least one FBMOD must be selected.');
  selected.forEach((file, index) => assertFile(file, `FBMOD ${index + 1}`));

  const cliDir = path.dirname(cli);
  const modsDir = path.join(workDir, 'mods');
  fs.mkdirSync(modsDir, { recursive: true });
  fs.mkdirSync(path.dirname(modData), { recursive: true });
  const updated = [];
  for (let index = 0; index < selected.length; index++) {
    const source = selected[index];
    const target = path.join(modsDir, `${String(index + 1).padStart(2, '0')}-${path.basename(source)}`);
    await run(dotnet, [cli, 'update-mod', gameExe, source, '--output', target, '--initfs-key', key], cliDir,
      `update-mod:${path.basename(source)}`);
    updated.push(target);
  }

  fs.writeFileSync(path.join(modsDir, 'load_order.json'), JSON.stringify(updated, null, 2));
  await run(dotnet, [cli, 'mod', gameExe, modsDir, modData, '--initfs-key', key], cliDir, 'apply-mods');
  const relativeDataPath = path.relative(path.dirname(gameExe), modData).replaceAll('\\', '/');
  if (relativeDataPath.startsWith('../') || path.isAbsolute(relativeDataPath)) {
    throw new Error('ModData must be inside the NFS Heat game directory before launch.');
  }
  emit('ready', { modData, launchArguments: ['-dataPath', relativeDataPath] });
}

main().catch(error => {
  emit('error', { message: error.stack || error.message });
  process.exitCode = 1;
});


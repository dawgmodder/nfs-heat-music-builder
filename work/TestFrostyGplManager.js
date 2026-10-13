'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'heat-frosty-manager-'));
const gameDir = path.join(root, 'game');
const gameExe = path.join(gameDir, 'NeedForSpeedHeat.exe');
const key = path.join(root, 'NFSHEAT.key');
const music = path.join(root, 'music.fbmod');
const unite = path.join(root, 'unite.fbmod');
const fakeCli = path.join(root, 'fake-cli.js');
const config = path.join(root, 'config.json');
const modData = path.join(gameDir, 'ModData', 'HeatCombined');
fs.mkdirSync(gameDir, { recursive: true });
for (const file of [gameExe, key, music, unite]) fs.writeFileSync(file, file);
fs.writeFileSync(fakeCli, `
const fs=require('fs'),path=require('path');
const a=process.argv.slice(2);
if(a[0]==='update-mod') fs.copyFileSync(a[2],a[a.indexOf('--output')+1]);
else if(a[0]==='mod') { fs.mkdirSync(a[3],{recursive:true}); fs.writeFileSync(path.join(a[3],'applied.txt'),'ok'); }
else process.exit(3);
`);
fs.writeFileSync(config, JSON.stringify({
  gameExe,
  frostyCli: fakeCli,
  dotnet: process.execPath,
  initFsKey: key,
  workDir: path.join(root, 'work'),
  modDataDir: modData,
  mods: [unite],
  musicMod: music,
}));

const manager = path.join(__dirname, 'FrostyGplManager.js');
const result = spawnSync(process.execPath, [manager, config], { encoding: 'utf8', windowsHide: true });
if (result.status !== 0) throw new Error(result.stdout + result.stderr);
const events = result.stdout.trim().split(/\r?\n/).map(line => JSON.parse(line));
const ready = events.find(event => event.type === 'ready');
if (!ready || !fs.existsSync(path.join(modData, 'applied.txt'))) throw new Error('Combined profile was not produced.');
if (ready.launchArguments.join(' ') !== '-dataPath ModData/HeatCombined') throw new Error('Unexpected launch arguments.');
console.log(JSON.stringify({ passed: true, stages: events.filter(event => event.type === 'stage').length,
  launchArguments: ready.launchArguments }));

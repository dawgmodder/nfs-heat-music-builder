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
const broken = path.join(root, 'broken.fbmod');
const fakeCli = path.join(root, 'fake-cli.js');
const config = path.join(root, 'config.json');
const modData = path.join(gameDir, 'ModData', 'HeatCombined');
fs.mkdirSync(gameDir, { recursive: true });
for (const file of [gameExe, key, music, unite]) fs.writeFileSync(file, file);
fs.writeFileSync(broken, 'FAIL');
fs.writeFileSync(fakeCli, `
const fs=require('fs'),path=require('path');
const a=process.argv.slice(2);
if(a[0]==='update-mod') fs.copyFileSync(a[2],a[a.indexOf('--output')+1]);
else if(a[0]==='mod') { const files=fs.readdirSync(a[2]).filter(x=>x.endsWith('.fbmod'));if(files.some(x=>fs.readFileSync(path.join(a[2],x),'utf8')==='FAIL'))process.exit(9);fs.mkdirSync(path.join(a[3],'Patch'),{recursive:true}); fs.writeFileSync(path.join(a[3],'applied.txt'),'ok'); fs.writeFileSync(path.join(a[3],'head.txt'),'1'); fs.writeFileSync(path.join(a[3],'mods.json'),JSON.stringify(files)); }
else process.exit(3);
`);
fs.writeFileSync(config, JSON.stringify({
  gameExe,
  frostyCli: fakeCli,
  dotnet: process.execPath,
  initFsKey: key,
  workDir: path.join(root, 'work'),
  cacheDir: path.join(root, 'cache'),
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
const second=spawnSync(process.execPath,[manager,config],{encoding:'utf8',windowsHide:true});
if(second.status!==0)throw new Error(second.stdout+second.stderr);
const secondEvents=second.stdout.trim().split(/\r?\n/).map(line=>JSON.parse(line));
if(secondEvents.filter(event=>event.type==='reused').length!==2)throw new Error('Updated FBMOD cache was not reused.');
const changedConfig=JSON.parse(fs.readFileSync(config,'utf8'));changedConfig.mods=[];fs.writeFileSync(config,JSON.stringify(changedConfig));
const changed=spawnSync(process.execPath,[manager,config],{encoding:'utf8',windowsHide:true});
if(changed.status!==0||JSON.parse(fs.readFileSync(path.join(modData,'mods.json'),'utf8')).length!==1)throw new Error('Deselected FBMOD remained in the assembly folder.');
const cancel=path.join(root,'cancel');fs.writeFileSync(cancel,'cancel');
const cancelledConfig=JSON.parse(fs.readFileSync(config,'utf8'));cancelledConfig.cancelFile=cancel;
fs.writeFileSync(config,JSON.stringify(cancelledConfig));
const before=fs.readFileSync(path.join(modData,'applied.txt'),'utf8');
const cancelled=spawnSync(process.execPath,[manager,config],{encoding:'utf8',windowsHide:true});
if(cancelled.status!==2||fs.readFileSync(path.join(modData,'applied.txt'),'utf8')!==before)throw new Error('Cancellation replaced the active profile.');
const failedConfig=JSON.parse(fs.readFileSync(config,'utf8'));delete failedConfig.cancelFile;failedConfig.mods=[broken];
fs.writeFileSync(config,JSON.stringify(failedConfig));
const failed=spawnSync(process.execPath,[manager,config],{encoding:'utf8',windowsHide:true});
if(failed.status!==1||fs.readFileSync(path.join(modData,'applied.txt'),'utf8')!==before)throw new Error('Failed assembly replaced the active profile.');
console.log(JSON.stringify({passed:true,stages:events.filter(event=>event.type==='stage').length,
  reused:secondEvents.filter(event=>event.type==='reused').length,selectionChangeRemovedStaleMods:true,cancelPreservedProfile:true,failurePreservedProfile:true,launchArguments:ready.launchArguments}));

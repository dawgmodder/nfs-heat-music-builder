'use strict';

// NFS Heat streams licensed music from the layer in which each original chunk
// lives. Frosty applies every chunk carried by one compiled mod to Patch. This
// module keeps the FBMOD metadata-only and installs the validated audio bytes in
// their original Data/Patch layer after Frosty has assembled the staging profile.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { readCatalogs, readLocation, writeLocation, resolveCas, locateChunk } = require('./HeatMusicCasAddress');

const shaBytes = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function assertFile(file, label) {
  if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile()) throw new Error(`${label} missing: ${file}`);
}
function linkFile(source, target) {
  try { fs.linkSync(source, target); }
  catch (error) {
    if (!['EXDEV', 'EPERM', 'EACCES'].includes(error.code)) throw error;
    fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
  }
}
function linkDirectory(source, target) {
  try { fs.symlinkSync(source, target, 'junction'); }
  catch (error) {
    if (!['EPERM', 'EACCES'].includes(error.code)) throw error;
    cloneTree(source, target, new Map(), new Set());
  }
}
function cloneTree(source, target, replacements, ancestors, relative = '') {
  fs.mkdirSync(target);
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    const rel = path.join(relative, entry.name).toLowerCase();
    const replacement = replacements.get(rel);
    if (replacement) { linkFile(replacement, to); continue; }
    if (entry.isDirectory()) {
      if (ancestors.has(rel)) cloneTree(from, to, replacements, ancestors, rel);
      else linkDirectory(from, to);
    } else linkFile(from, to);
  }
}
function wrapEa(raw) {
  const parts = [];
  for (let at = 0; at < raw.length;) {
    const count = Math.min(65536, raw.length - at);
    const block = Buffer.allocUnsafe(count + 8);
    block.writeUInt32BE(count, 0);
    block.writeUInt16BE(count === 65536 ? 0x71 : 0x70, 4);
    block.writeUInt16BE(count === 65536 ? 0 : count, 6);
    raw.copy(block, 8, at, at + count);
    parts.push(block); at += count;
  }
  return Buffer.concat(parts);
}
function unwrapCasInterval(file, offset, size) {
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(size) || size <= 0 ||
      offset + size > fs.statSync(file).size) throw new Error(`Invalid CAS interval: ${file}`);
  const fd = fs.openSync(file, 'r');
  const wrapped = Buffer.alloc(size);
  try {
    if (fs.readSync(fd, wrapped, 0, size, offset) !== size) throw new Error(`Short CAS read: ${file}`);
  } finally { fs.closeSync(fd); }
  const parts = []; let at = 0;
  while (at < wrapped.length) {
    if (at + 8 > wrapped.length) throw new Error(`Truncated CAS block header: ${file}`);
    const rawSize = wrapped.readUInt32BE(at);
    const codec = wrapped.readUInt16BE(at + 4);
    const stored = wrapped.readUInt16BE(at + 6) || 65536;
    if ((codec !== 0x70 && codec !== 0x71) || rawSize !== stored || at + 8 + stored > wrapped.length)
      throw new Error(`Unexpected compressed CAS block in music interval: ${file}`);
    parts.push(wrapped.subarray(at + 8, at + 8 + stored)); at += 8 + stored;
  }
  return Buffer.concat(parts);
}
function validateOnlyMusicLocationsDiffer(original, generated, placements) {
  if (original.length !== generated.length) throw new Error('Prepared Data TOC size differs from the installed game');
  const allowed = new Uint8Array(original.length);
  for (const item of placements) {
    if (!Number.isInteger(item.tocOffset) || item.tocOffset < 0 || item.tocOffset + 12 > allowed.length)
      throw new Error(`Invalid Data TOC offset: ${item.name}`);
    allowed.fill(1, item.tocOffset, item.tocOffset + 12);
  }
  for (let at = 0; at < original.length; at++)
    if (!allowed[at] && original[at] !== generated[at])
      throw new Error(`Prepared Data TOC changes a non-music byte at ${at}`);
}
function preparedDataAudio(buildDir, item) {
  const packageName = item.cas === 8 ? 'superbundleinstallpackage2' : 'superbundleinstallpackage';
  const cas = path.join(buildDir, `cas_${String(item.cas).padStart(2, '0')}.cas`);
  assertFile(cas, `Prepared Data ${packageName} audio archive`);
  const raw = unwrapCasInterval(cas, item.newOffset, item.newSize);
  if (raw.length !== item.audioBytes || shaBytes(raw) !== item.audioSha256)
    throw new Error(`Prepared Data audio checksum mismatch: ${item.name}`);
  return raw;
}
function patchDataLayer(staging, buildDir, manifest, gameRoot) {
  const catalogs = readCatalogs(staging);
  const active = path.join(staging, 'Data');
  if (!fs.existsSync(active)) throw new Error('Frosty staging profile has no Data layer');
  const source = fs.realpathSync(active);
  const sourceToc = path.join(source, 'Win32', 'chunks0.toc');
  assertFile(sourceToc, 'Staging Data chunks0.toc');
  const originalTocFile = path.join(gameRoot, 'Data', 'Win32', 'chunks0.toc');
  assertFile(originalTocFile, 'Original game Data chunks0.toc');
  validateOnlyMusicLocationsDiffer(fs.readFileSync(originalTocFile),
    fs.readFileSync(path.join(buildDir, 'chunks0.toc')), manifest.placements);
  const originalToc = fs.readFileSync(originalTocFile);
  const stagingToc = fs.readFileSync(sourceToc);
  for (const item of manifest.placements) {
    const at = item.tocOffset;
    if (locateChunk(originalToc, item.chunkId) !== at || locateChunk(stagingToc, item.chunkId) !== at)
      throw new Error(`Data chunk table changed: ${item.name}`);
    if (stagingToc.subarray(at, at + 12).compare(originalToc.subarray(at, at + 12)) !== 0)
      throw new Error(`Data music chunk conflicts with another selected mod: ${item.name}`);
  }
  // Materialize every destination catalog before replacing files. A directory
  // junction at a destination would otherwise redirect writes into the game.
  const ancestors = new Set(['win32']);
  for (const bundle of catalogs.values()) {
    const parts = bundle.split(/[\\/]/);
    for (let i = 1; i <= parts.length; i++) ancestors.add(path.join(...parts.slice(0, i)).toLowerCase());
  }
  const temporary = `${active}.music-overlay-${process.pid}`;
  if (fs.existsSync(temporary)) fs.rmSync(temporary, { recursive: true, force: true });
  cloneTree(source, temporary, new Map(), ancestors);
  if (fs.lstatSync(active).isSymbolicLink()) fs.unlinkSync(active);
  else fs.rmSync(active, { recursive: true, force: true });
  fs.renameSync(temporary, active);

  const tocFile = path.join(active, 'Win32', 'chunks0.toc');
  const toc = Buffer.from(stagingToc);
  const installed = [];
  const groups = new Map();
  for (const item of manifest.placements) {
    const loc = { ...readLocation(originalToc, item.tocOffset), cas: item.cas };
    if (loc.patch) throw new Error(`Data chunk unexpectedly points to Patch: ${item.name}`);
    const key = `${loc.catalog}:${loc.cas}`;
    if (!groups.has(key)) groups.set(key, { loc, rows: [] });
    groups.get(key).rows.push(item);
  }
  for (const { loc, rows } of groups.values()) {
    const casNumber = loc.cas;
    const casFile = resolveCas(staging, loc, catalogs);
    assertFile(casFile, `Staging Data cas_${String(casNumber).padStart(2, '0')}.cas`);
    const casTemp = `${casFile}.music-${process.pid}`;
    fs.copyFileSync(casFile, casTemp, fs.constants.COPYFILE_EXCL);
    let cursor = fs.statSync(casTemp).size;
    try {
      for (const item of rows) {
        const raw = preparedDataAudio(buildDir, item);
        const wrapped = wrapEa(raw);
        if (cursor + wrapped.length > 0xffffffff)
          throw new Error(`Data cas_${String(casNumber).padStart(2, '0')} exceeds the 32-bit offset limit`);
        const at = item.tocOffset;
        writeLocation(toc, at, { ...loc, offset: cursor, size: wrapped.length });
        fs.appendFileSync(casTemp, wrapped);
        installed.push({ item, offset: cursor, size: wrapped.length, cas: casFile });
        cursor += wrapped.length;
      }
      fs.rmSync(casFile, { force: true }); fs.renameSync(casTemp, casFile);
    } catch (error) {
      try { fs.rmSync(casTemp, { force: true }); } catch {}
      throw error;
    }
  }
  const tocTemp = `${tocFile}.music-${process.pid}`;
  fs.writeFileSync(tocTemp, toc, { flag: 'wx' });
  fs.rmSync(tocFile, { force: true }); fs.renameSync(tocTemp, tocFile);
  return installed;
}
function patchPatchLayer(staging, buildDir, manifest, gameRoot) {
  const items = [manifest.patchAudio, ...(manifest.patchExtras || [])].filter(Boolean);
  if (!items.length) return [];
  if (items.length !== 7) throw new Error(`Expected either 0 or 7 Patch music chunks, found ${items.length}`);
  const patch = path.join(staging, 'Patch');
  const tocFile = path.join(patch, 'Win32', 'chunks0.toc');
  const casFile = path.join(patch, 'Win32', 'configurations', 'superbundleinstallpackage2', 'cas_14.cas');
  assertFile(tocFile, 'Staging Patch chunks0.toc'); assertFile(casFile, 'Staging Patch cas_14.cas');
  const toc = fs.readFileSync(tocFile);
  const originalTocFile = path.join(gameRoot, 'Patch', 'Win32', 'chunks0.toc');
  assertFile(originalTocFile, 'Original game Patch chunks0.toc');
  const originalToc = fs.readFileSync(originalTocFile);
  const catalogs = readCatalogs(staging);
  for (const item of items) {
    if (locateChunk(originalToc, item.chunkId) !== item.tocOffset || locateChunk(toc, item.chunkId) !== item.tocOffset)
      throw new Error(`Patch chunk table changed: ${item.name}`);
    const loc = { ...readLocation(originalToc, item.tocOffset), patch: true, cas: 14 };
    if (resolveCas(staging, loc, catalogs).toLowerCase() !== casFile.toLowerCase())
      throw new Error(`Unexpected Patch music catalog: ${item.name}`);
  }
  const casTemp = `${casFile}.music-${process.pid}`;
  fs.copyFileSync(casFile, casTemp, fs.constants.COPYFILE_EXCL);
  let cursor = fs.statSync(casTemp).size;
  const installed = [];
  try {
    for (const item of items) {
      const at = item.tocOffset;
      if (!Number.isInteger(at) || at < 0 || at + 12 > toc.length || at + 12 > originalToc.length)
        throw new Error(`Invalid Patch TOC offset: ${item.name}`);
      if (originalToc.subarray(at, at + 12).toString('hex') !== item.oldLocation)
        throw new Error(`Patch music identity no longer matches the installed game: ${item.name}`);
      if (toc.readUInt32BE(at + 8) === 0)
        throw new Error(`Selected mods left an invalid Patch chunk record: ${item.name}`);
      const relative = item.audioFile || 'playlist-patch.ealayer3';
      const audio = path.resolve(buildDir, relative);
      if (!audio.startsWith(buildDir + path.sep)) throw new Error(`Unsafe Patch audio path: ${item.name}`);
      assertFile(audio, 'Prepared Patch audio');
      const raw = fs.readFileSync(audio);
      if (raw.length !== item.audioBytes || shaBytes(raw) !== item.audioSha256)
        throw new Error(`Prepared Patch audio checksum mismatch: ${item.name}`);
      const wrapped = wrapEa(raw);
      if (cursor + wrapped.length > 0xffffffff) throw new Error('Patch music CAS exceeds the 32-bit offset limit');
      writeLocation(toc, at, { ...readLocation(originalToc, at), patch: true, cas: 14, offset: cursor, size: wrapped.length });
      fs.appendFileSync(casTemp, wrapped);
      installed.push({ item, offset: cursor, size: wrapped.length, audio });
      cursor += wrapped.length;
    }
    const tocTemp = `${tocFile}.music-${process.pid}`;
    fs.writeFileSync(tocTemp, toc, { flag: 'wx' });
    fs.rmSync(tocFile, { force: true }); fs.renameSync(tocTemp, tocFile);
    fs.rmSync(casFile, { force: true }); fs.renameSync(casTemp, casFile);
  } catch (error) {
    try { fs.rmSync(casTemp, { force: true }); } catch {}
    throw error;
  }
  return installed;
}
function validateInstalledAudio(staging, manifest) {
  if (!Array.isArray(manifest.placements) || !manifest.placements.length)
    throw new Error('Prepared soundtrack has no Data music placements');
  const catalogs = readCatalogs(staging);
  let checked = 0;
  const patch = [manifest.patchAudio, ...(manifest.patchExtras || [])].filter(Boolean);
  for (const [layer, items] of [['Data', manifest.placements], ['Patch', patch]]) {
    if (!items.length) continue;
    const toc = fs.readFileSync(path.join(staging, layer, 'Win32', 'chunks0.toc'));
    for (const item of items) {
      const at = locateChunk(toc, item.chunkId), loc = readLocation(toc, at);
      const context = `${layer} ${item.name} (${item.chunkId}) catalog=${loc.catalog} cas=${loc.cas} offset=${loc.offset} size=${loc.size}`;
      if (loc.patch !== (layer === 'Patch')) throw new Error('Installed layer mismatch: ' + context);
      const cas = resolveCas(staging, loc, catalogs);
      let raw;
      try { raw = unwrapCasInterval(cas, loc.offset, loc.size); }
      catch (error) { throw new Error(`Installed audio address invalid: ${context}: ${error.message}`); }
      if (raw.length !== item.audioBytes || shaBytes(raw) !== item.audioSha256)
        throw new Error('Installed audio payload mismatch: ' + context);
      checked++;
    }
  }
  const expected=manifest.placements.length+patch.length;
  if (checked !== expected) throw new Error(`Layered audio validation count mismatch: ${checked}/${expected}`);
  return checked;
}
function applyLayeredOverlay({ staging, buildDir, gameRoot }) {
  staging = path.resolve(staging); buildDir = path.resolve(buildDir);
  gameRoot = path.resolve(gameRoot);
  const manifestFile = path.join(buildDir, 'manifest.json'); assertFile(manifestFile, 'Music build manifest');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  if (manifest.id !== path.basename(buildDir) || manifest.frostyPayloadMode !== 'metadata-with-layered-audio-overlay')
    throw new Error('Soundtrack was built by an incompatible V5 version; rebuild it with this version');
  const dataInstalled = patchDataLayer(staging, buildDir, manifest, gameRoot);
  const patchInstalled = patchPatchLayer(staging, buildDir, manifest, gameRoot);
  const checked = validateInstalledAudio(staging, manifest);
  return { checked, data: manifest.placements.length, patch: patchInstalled.length, buildId: manifest.id };
}

module.exports = { applyLayeredOverlay, validateInstalledAudio, unwrapCasInterval, wrapEa };

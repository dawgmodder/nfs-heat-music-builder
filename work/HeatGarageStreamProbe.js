'use strict';
// Diagnostic only. Creates a separate, never-overwritten profile. Does not repair
// the production pipeline or infer which resolution path the game actually uses.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');
const { readCatalogs, locateChunk, readLocation, writeLocation, resolveCas } = require('./HeatMusicCasAddress');
const targets = Object.freeze([
  '893fe439-0a8a-2b1c-d292-6658ca610755',
  '77f608ad-4261-d1b0-da7d-465491e702cd'
]);
const relativeToc = 'Data/Win32/chunks1.toc';
function sha(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function readRange(file, offset, size) {
  assert(Number.isSafeInteger(offset) && Number.isSafeInteger(size) && offset >= 0 && size > 0);
  const fd = fs.openSync(file, 'r');
  try {
    assert(offset + size <= fs.fstatSync(fd).size, 'CAS range exceeds file');
    const bytes = Buffer.alloc(size);
    assert.equal(fs.readSync(fd, bytes, 0, size, offset), size);
    return bytes;
  } finally { fs.closeSync(fd); }
}
function prepare(source, destination, bundleReport, execute = false) {
  source = fs.realpathSync(source);
  destination = path.resolve(destination);
  assert(!fs.existsSync(destination), 'Diagnostic destination already exists; refusing to overwrite');
  assert.equal(path.dirname(source).toLowerCase(), path.dirname(destination).toLowerCase(), 'Profiles must be siblings');
  assert.equal(path.basename(path.dirname(source)).toLowerCase(), 'moddata');
  assert.notEqual(path.basename(destination).toLowerCase(), path.basename(source).toLowerCase());
  assert.equal(fs.realpathSync(bundleReport.summary.profile).toLowerCase(), source.toLowerCase());
  assert.equal(bundleReport.summary.errors, 0);
  const sourceToc = path.join(source, relativeToc), before = fs.readFileSync(sourceToc), after = Buffer.from(before);
  const catalogs = readCatalogs(source), changes = [];
  for (const guid of targets) {
    const matches = bundleReport.garagePayloads.filter(r => r.type === 3 && r.name.toLowerCase() === guid);
    assert(matches.length > 0 && matches.every(r => r.matches === true), 'Missing verified bundle payload');
    assert(matches.every(r => r.sha256 === matches[0].sha256), 'Conflicting bundle payloads');
    const selected = matches[0], location = selected.loc;
    const wanted = sha(readRange(resolveCas(source, location, catalogs), location.offset, location.size));
    assert.equal(wanted, selected.expected, 'Source changed since audit');
    const at = locateChunk(before, guid), old = readLocation(before, at);
    const previousHash = sha(readRange(resolveCas(source, old, catalogs), old.offset, old.size));
    assert.notEqual(previousHash, wanted, 'Reference already resolves to expected bytes; hypothesis not applicable');
    writeLocation(after, at, location);
    changes.push({ guid, offset: at, previous: old, replacement: location, previousHash, expectedHash: wanted });
  }
  // No changes to GUIDs, hash maps, bundle metadata, sounds, or payload bytes.
  for (let i = 0; i < before.length; i++) {
    if (!changes.some(c => i >= c.offset && i < c.offset + 12)) assert.equal(after[i], before[i]);
  }
  const files = [], directories = [], junctions = [];
  const gameRoot = fs.realpathSync(path.dirname(path.dirname(source)));
  function walk(dir, relative = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = path.join(relative, entry.name), full = path.join(dir, entry.name), st = fs.lstatSync(full);
      if (st.isSymbolicLink()) {
        const real = fs.realpathSync(full), within = path.relative(gameRoot, real);
        assert(within && !within.startsWith('..') && !path.isAbsolute(within), 'Source link escapes game: ' + rel);
        if (fs.statSync(real).isDirectory()) junctions.push({ rel, real });
        else { assert(fs.statSync(real).isFile()); files.push(rel); }
      }
      else if (st.isDirectory()) { directories.push(rel); walk(full, rel); }
      else { assert(st.isFile(), 'Unsupported source entry: ' + rel); files.push(rel); }
    }
  }
  walk(source);
  const report = { schema: 1, diagnosticOnly: true, source, destination, changes, files: files.length, junctions: junctions.length,
    originalTocHash: sha(before), diagnosticTocHash: sha(after), gameTested: false, created: false };
  if (!execute) return report;
  fs.mkdirSync(destination); // Exclusive: never reuse an existing profile.
  for (const rel of directories) fs.mkdirSync(path.join(destination, rel));
  for (const { rel, real } of junctions) fs.symlinkSync(real, path.join(destination, rel), 'junction');
  for (const rel of files) {
    const src = path.join(source, rel), dst = path.join(destination, rel);
    if (rel.replaceAll('\\', '/') === relativeToc) fs.writeFileSync(dst, after, { flag: 'wx' });
    else fs.linkSync(src, dst); // Read-only sharing; never write to linked files.
  }
  const targetToc = path.join(destination, relativeToc);
  assert.equal(fs.statSync(targetToc).nlink, 1);
  assert.notEqual(fs.statSync(targetToc).ino, fs.statSync(sourceToc).ino);
  assert.equal(sha(fs.readFileSync(sourceToc)), report.originalTocHash);
  assert.equal(sha(fs.readFileSync(targetToc)), report.diagnosticTocHash);
  const finalCatalogs = readCatalogs(destination);
  for (const c of changes) {
    const loc = readLocation(fs.readFileSync(targetToc), c.offset);
    assert.equal(sha(readRange(resolveCas(destination, loc, finalCatalogs), loc.offset, loc.size)), c.expectedHash);
  }
  report.created = true;
  return report;
}
module.exports = { prepare, targets };

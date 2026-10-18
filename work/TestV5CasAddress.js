'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert'), crypto = require('crypto');
const { readCatalogs, readLocation, writeLocation, resolveCas, locateChunk } = require('./HeatMusicCasAddress');
const { wrapEa, validateInstalledAudio, applyLayeredOverlay } = require('./HeatMusicV5LayeredOverlay');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'heat-cas-address-'));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const z = s => Buffer.from(s + '\0');
const obj = (name, children, list = false) => Buffer.concat([Buffer.from([list ? 1 : 2]), z(name), Buffer.from([0]), ...children, Buffer.from([0])]);
const str = (name, s) => Buffer.concat([Buffer.from([7]), z(name), Buffer.from([s.length + 1]), z(s)]);
const integer = (name, n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return Buffer.concat([Buffer.from([8]), z(name), b]); };
const layout = obj('', [obj('installManifest', [obj('installChunks', [0, 1].map(i =>
  obj('', [integer('persistentIndex', i), str('installBundle', 'Win32/catalog' + i)])), true)])]);
function save(file, b) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, b); }
save(path.join(root, 'Patch/layout.toc'), layout);
const catalogs = readCatalogs(root); assert.equal(catalogs.get(1), 'Win32/catalog1');
const guid = '00112233-4455-6677-8899-aabbccddeeff';
function toc(loc) {
  const b = Buffer.alloc(620); b.writeUInt32BE(28, 572); b.writeUInt32BE(1, 576); b.writeUInt32BE(48, 580);
  // Literal on-disk GUID, independent of the production GUID encoder.
  Buffer.from('ffeeddccbbaa99886677445500112233', 'hex').copy(b, 584);
  writeLocation(b, 604, loc); return b;
}
const raw = Buffer.from('complete playlist audio, not the short intro'), wrapped = wrapEa(raw);
const item = { chunkId: guid, name: 'test-playlist', audioBytes: raw.length, audioSha256: sha(raw), cas: 8, tocOffset: 604 };
const loc = { patch: false, catalog: 1, cas: 8, offset: 0, size: wrapped.length };
const manifest = { placements: [item] };
const tocPath = path.join(root, 'Data/Win32/chunks0.toc');
save(resolveCas(root, loc, catalogs), wrapped); save(resolveCas(root, { ...loc, catalog: 0 }, catalogs), wrapEa(Buffer.alloc(raw.length)));
save(tocPath, toc(loc)); assert.equal(locateChunk(toc(loc), guid), 604);
assert.equal(validateInstalledAudio(root, manifest), 1);
save(tocPath, toc({ ...loc, catalog: 0 })); assert.throws(() => validateInstalledAudio(root, manifest), /payload mismatch/);
save(tocPath, toc({ ...loc, catalog: 2 })); assert.throws(() => validateInstalledAudio(root, manifest), /Unknown CAS catalog/);
save(tocPath, toc({ ...loc, offset: 10000 })); assert.throws(() => validateInstalledAudio(root, manifest), /Invalid CAS interval/);
save(tocPath, toc({ ...loc, size: wrapped.length - 1 })); assert.throws(() => validateInstalledAudio(root, manifest), /CAS block/);
save(tocPath, toc(loc)); assert.throws(() => validateInstalledAudio(root, { placements: [{ ...item, audioSha256: '0'.repeat(64) }] }), /payload mismatch/);
assert.throws(() => locateChunk(toc(loc), '11112233-4455-6677-8899-aabbccddeeff'), /found 0/);
assert.throws(() => writeLocation(toc(loc), 604, { ...loc, offset: 2 ** 32 }), /Invalid CAS offset/);
// Lobby catalog 0 and Patch catalog 1 must remain distinct and valid.
save(resolveCas(root, { ...loc, catalog: 0 }, catalogs), wrapped); save(tocPath, toc({ ...loc, catalog: 0 }));
assert.equal(validateInstalledAudio(root, manifest), 1);
save(resolveCas(root, { ...loc, patch: true }, catalogs), wrapped);
save(path.join(root, 'Patch/Win32/chunks0.toc'), toc({ ...loc, patch: true }));
assert.equal(validateInstalledAudio(root, { ...manifest, patchAudio: item }), 2);
// Exercise the actual writer, not a copy: source Data files must stay unchanged.
const game = path.join(root, 'game'), staging = path.join(root, 'staging'), build = path.join(root, 'test-build');
save(path.join(game, 'Data/Win32/chunks0.toc'), toc(loc));
save(resolveCas(game, loc, catalogs), wrapped);
save(path.join(staging, 'Patch/layout.toc'), layout);
fs.symlinkSync(path.join(game, 'Data'), path.join(staging, 'Data'), 'junction');
save(path.join(build, 'chunks0.toc'), toc(loc)); save(path.join(build, 'cas_08.cas'), wrapped);
const prepared = { id: 'test-build', frostyPayloadMode: 'metadata-with-layered-audio-overlay',
  placements: [{ ...item, newOffset: 0, newSize: wrapped.length }] };
save(path.join(build, 'manifest.json'), JSON.stringify(prepared));
assert.equal(applyLayeredOverlay({ staging, buildDir: build, gameRoot: game }).checked, 1);
const final = readLocation(fs.readFileSync(path.join(staging, 'Data/Win32/chunks0.toc')), 604);
assert.equal(final.catalog, 1); assert.equal(final.offset, wrapped.length);
assert.deepEqual(fs.readFileSync(resolveCas(game, loc, catalogs)), wrapped);
assert.deepEqual(fs.readFileSync(path.join(game, 'Data/Win32/chunks0.toc')), toc(loc));
console.log('PASS: real writer, independent GUID fixture, catalog 0/1, Patch, wrong catalog, unknown catalog, invalid bounds, truncation, hash, GUID, uint32, source preservation');
console.log('Fixtures preserved at ' + root);

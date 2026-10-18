'use strict';
// Heat's short TOC file identifier is [reserved, patch, installChunkIndex, cas].
// Resolve from the final layout, never by guessing the catalog from a CAS number.
const fs = require('fs');
const path = require('path');
function readLayout(file) {
  const b = fs.readFileSync(file); let p = 0;
  function need(n) { if (!Number.isSafeInteger(n) || n < 0 || p + n > b.length) throw new Error('Truncated layout: ' + file); }
  need(4);
  if ([0x01ced100, 0x03ced100].includes(b.readUInt32LE(0))) p = 556;
  function variable() {
    let n = 0, scale = 1, x;
    do { need(1); x = b[p++]; n += (x & 127) * scale; scale *= 128;
      if (!Number.isSafeInteger(n) || scale > 2 ** 56) throw new Error('Invalid layout varint');
    } while (x & 128); return n;
  }
  function z() { const end = b.indexOf(0, p); if (end < p) throw new Error('Unterminated layout string');
    const s = b.toString('utf8', p, end); p = end + 1; return s; }
  function item(depth = 0) {
    if (depth > 64) throw new Error('Layout nesting limit');
    need(1); const t = b[p++]; if (!t) return null;
    const name = t & 128 ? '' : z(); let value, n;
    switch (t & 127) {
      case 1: case 2: {
        variable(); value = (t & 127) === 1 ? [] : Object.create(null); let child;
        while ((child = item(depth + 1)) !== null) {
          if (Array.isArray(value)) value.push(child.value); else value[child.name] = child.value;
        } break;
      }
      case 6: need(1); value = !!b[p++]; break;
      case 7: n = variable(); need(n); value = b.toString('utf8', p, p + n).replace(/\0$/, ''); p += n; break;
      case 8: need(4); value = b.readUInt32LE(p); p += 4; break;
      case 9: need(8); value = b.readBigUInt64LE(p).toString(); p += 8; break;
      case 11: need(4); value = b.readFloatLE(p); p += 4; break;
      case 12: need(8); value = b.readDoubleLE(p); p += 8; break;
      case 15: case 16: n = (t & 127) === 15 ? 16 : 20; need(n); p += n; break;
      case 19: n = variable(); need(n); p += n; break;
      default: throw new Error('Unsupported layout field type: ' + (t & 127));
    }
    return { name, value };
  }
  return item().value;
}
function readCatalogs(profile) {
  const chunks = readLayout(path.join(profile, 'Patch', 'layout.toc')).installManifest?.installChunks;
  if (!Array.isArray(chunks) || !chunks.length) throw new Error('Layout has no install catalogs');
  const map = new Map();
  chunks.forEach((chunk, i) => {
    const index = chunk.persistentIndex ?? i, bundle = chunk.installBundle;
    if (!Number.isInteger(index) || index < 0 || index > 255 || map.has(index) ||
        typeof bundle !== 'string' || !/^Win32[\\/]/i.test(bundle) ||
        bundle.split(/[\\/]/).some(x => !x || x === '.' || x === '..') || /:/.test(bundle))
      throw new Error('Invalid install catalog in layout');
    map.set(index, bundle);
  });
  return map;
}
function readLocation(toc, at) {
  if (!Number.isInteger(at) || at < 0 || at + 12 > toc.length) throw new Error('Invalid TOC location');
  if (toc[at] !== 0 || toc[at + 1] > 1) throw new Error('Unsupported Heat file identifier');
  return { patch: !!toc[at + 1], catalog: toc[at + 2], cas: toc[at + 3],
    offset: toc.readUInt32BE(at + 4), size: toc.readUInt32BE(at + 8) };
}
function writeLocation(toc, at, loc) {
  readLocation(toc, at);
  for (const [key, max] of [['catalog', 255], ['cas', 255], ['offset', 0xffffffff], ['size', 0xffffffff]])
    if (!Number.isInteger(loc[key]) || loc[key] < 0 || loc[key] > max) throw new Error('Invalid CAS ' + key);
  if (typeof loc.patch !== 'boolean' || !loc.size) throw new Error('Invalid CAS location');
  toc.writeUInt32BE(((loc.patch ? 1 << 16 : 0) | (loc.catalog << 8) | loc.cas) >>> 0, at);
  toc.writeUInt32BE(loc.offset, at + 4); toc.writeUInt32BE(loc.size, at + 8);
}
function resolveCas(profile, loc, catalogs) {
  const bundle = catalogs.get(loc.catalog);
  if (!bundle) throw new Error('Unknown CAS catalog ' + loc.catalog);
  return path.join(profile, loc.patch ? 'Patch' : 'Data', bundle, `cas_${String(loc.cas).padStart(2, '0')}.cas`);
}
function locateChunk(toc, guid) {
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(guid || '') || toc.length < 584)
    throw new Error('Invalid chunk GUID or TOC');
  const b = Buffer.from(guid.replaceAll('-', ''), 'hex');
  b.subarray(0, 4).reverse(); b.subarray(4, 6).reverse(); b.subarray(6, 8).reverse(); b.reverse();
  const start = toc.readUInt32BE(572) + 556, count = toc.readUInt32BE(576), base = toc.readUInt32BE(580) + 556;
  if (start + count * 20 > toc.length || base > toc.length) throw new Error('Invalid TOC chunk table');
  const hits = [];
  for (let i = 0; i < count; i++) {
    const at = start + i * 20;
    if (toc.subarray(at, at + 16).equals(b)) {
      const entry = toc.readUInt32BE(at + 16) & 0xffffff;
      if (entry % 3) throw new Error('Unsupported TOC chunk entry');
      const location = base + entry * 4; readLocation(toc, location); hits.push(location);
    }
  }
  if (hits.length !== 1) throw new Error(`Expected one TOC entry for ${guid}, found ${hits.length}`);
  return hits[0];
}
module.exports = { readCatalogs, readLocation, writeLocation, resolveCas, locateChunk };

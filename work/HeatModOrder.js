'use strict';
const path = require('path');

// UI: bottom wins, soundtrack last/highest. The pinned GPL executor instead
// keeps the FIRST ordinary EBX/RES/chunk payload, so reverse only at its boundary.
function resolveModOrder(mods, soundtrack) {
  if (!Array.isArray(mods)) throw new Error('Mod selection must be an array');
  const displayOrder = [...mods, soundtrack].filter(Boolean).map(file => {
    if (typeof file !== 'string') throw new Error('Mod path must be a string');
    return path.resolve(file);
  });
  if (!displayOrder.length) throw new Error('At least one FBMOD must be selected.');
  if (new Set(displayOrder.map(file => file.toLowerCase())).size !== displayOrder.length)
    throw new Error('The same FBMOD is selected more than once.');
  return { displayOrder, executorOrder: [...displayOrder].reverse() };
}
module.exports = { resolveModOrder };

'use strict';
const fs = require('fs');
const path = require('path');

function inside(root, file) {
  const relative = path.relative(root, file);
  return !relative || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep));
}

// Physical directories survive deletion/rename of the staging source. Resolve
// file links before hard-linking; copying is the cross-volume fallback.
function materializeTree(source, destination, chain = new Set()) {
  const real = fs.realpathSync(source);
  if (chain.has(real)) throw new Error(`Profile directory cycle: ${source}`);
  const next = new Set(chain).add(real);
  fs.mkdirSync(destination);
  for (const entry of fs.readdirSync(real)) {
    const from = fs.realpathSync(path.join(real, entry));
    const to = path.join(destination, entry);
    const stat = fs.statSync(from);
    if (stat.isDirectory()) materializeTree(from, to, next);
    else if (stat.isFile()) {
      try { fs.linkSync(from, to); }
      catch (error) {
        if (!['EXDEV', 'EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) throw error;
        fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
      }
    } else throw new Error(`Unsupported profile entry: ${from}`);
  }
}

function validateProfileTree(root, forbiddenRoots = [root]) {
  root = path.resolve(root);
  const forbidden = forbiddenRoots.map(p => path.resolve(p));
  let files = 0, links = 0;
  function visit(file, chain) {
    const lst = fs.lstatSync(file);
    if (lst.isSymbolicLink()) {
      links++;
      const target = path.resolve(path.dirname(file), fs.readlinkSync(file));
      if (forbidden.some(base => inside(base, target)))
        throw new Error(`Profile link depends on a temporary/profile path: ${file} -> ${target}`);
    }
    let real, stat;
    try { real = fs.realpathSync(file); stat = fs.statSync(file); }
    catch (error) { throw new Error(`Unreadable profile entry: ${file}: ${error.code}`); }
    if (lst.isSymbolicLink() && forbidden.some(base => inside(base, real)))
      throw new Error(`Profile link resolves into temporary/profile data: ${file}`);
    if (stat.isDirectory()) {
      if (chain.has(real)) throw new Error(`Profile directory cycle: ${file}`);
      const next = new Set(chain).add(real);
      for (const name of fs.readdirSync(file)) visit(path.join(file, name), next);
    } else if (stat.isFile()) {
      const fd = fs.openSync(file, 'r'); fs.closeSync(fd); files++;
    } else throw new Error(`Unsupported profile entry: ${file}`);
  }
  // The profile itself may be exposed through a stable user-facing junction.
  for (const entry of fs.readdirSync(root)) visit(path.join(root, entry), new Set([fs.realpathSync(root)]));
  return { files, links };
}

function publishProfile(staging, target, previous, validate = validateProfileTree) {
  validate(staging, [staging, target, previous]);
  if (fs.existsSync(previous)) throw new Error(`Previous profile backup already exists: ${previous}`);
  let movedPrevious = false, published = false;
  try {
    if (fs.existsSync(target)) { fs.renameSync(target, previous); movedPrevious = true; }
    fs.renameSync(staging, target); published = true;
    return validate(target, [staging, target, previous]);
  } catch (error) {
    // Return the failed candidate to staging before restoring the working one.
    if (published) fs.renameSync(target, staging);
    if (movedPrevious) fs.renameSync(previous, target);
    throw error;
  }
}

function validateGameFileCoverage(profile, gameRoot) {
  let required = 0;
  function walk(relative, chain) {
    const source = path.join(gameRoot, relative), real = fs.realpathSync(source);
    if (chain.has(real)) throw new Error(`Game directory cycle: ${source}`);
    const next = new Set(chain).add(real);
    for (const name of fs.readdirSync(source)) {
      const rel = path.join(relative, name), original = fs.statSync(path.join(gameRoot, rel));
      if (original.isDirectory()) walk(rel, next);
      else if (original.isFile()) {
        const file = path.join(profile, rel);
        const stat = fs.statSync(file, { throwIfNoEntry: false });
        if (!stat?.isFile() || (original.size > 0 && stat.size === 0))
          throw new Error(`Required game file missing/empty in profile: ${file}`);
        required++;
      }
    }
  }
  for (const layer of ['Data', 'Patch']) walk(layer, new Set());
  return required;
}

module.exports = { materializeTree, validateProfileTree, publishProfile, validateGameFileCoverage };

// Stamps the service worker cache name with a hash of everything it ships,
// so a deployed change can never be served from a stale cache. Ported from
// the aimless repo — same mechanism, root-level file layout.
//
//   node scripts/stamp-sw.mjs           rewrite service-worker.js in place
//   node scripts/stamp-sw.mjs --check   exit 1 if the stamp is out of date
//
// Zero dependencies.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const SW = join(ROOT, 'service-worker.js');

// The deploy job stages exactly these paths into _site/ — the hash covers the
// same set so any shipped change moves the stamp. Tests, docs and scripts are
// not served, so they do not belong to the fingerprint.
const SHIPPED = [
  'index.html', 'app.js', 'styles.css', 'manifest.json',
  'icons', 'engine',
];

// service-worker.js is excluded: it is the file we are about to rewrite, so
// including it would make the hash depend on itself and never settle.
// .DS_Store is excluded at any depth: macOS metadata that exists locally but
// not in CI, so including it makes the stamp pass on macOS and fail on Linux.
// .git is excluded: engine/ is a git submodule, and its .git gitfile records a
// machine-specific path (absolute in CI checkouts, relative locally) —
// including it makes the stamp machine-dependent.
const EXCLUDE = new Set(['service-worker.js', '.DS_Store', '.git']);

/** Every shipped file, as paths relative to the repo root, sorted. */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE.has(entry)) continue;
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) out.push(...walk(abs));
    else out.push(abs);
  }
  return out;
}

function shippedFiles() {
  const out = [];
  for (const rel of SHIPPED) {
    const abs = join(ROOT, rel);
    if (statSync(abs).isDirectory()) out.push(...walk(abs));
    else if (!EXCLUDE.has(rel)) out.push(abs);
  }
  return out.sort();
}

/** Hash of the shipped tree: paths as well as bytes, so a rename counts. */
function fingerprint() {
  const h = createHash('sha256');
  for (const abs of shippedFiles()) {
    h.update(relative(ROOT, abs).split(sep).join('/'));
    h.update('\0');
    h.update(readFileSync(abs));
    h.update('\0');
  }
  return h.digest('hex').slice(0, 8);
}

const wanted = `wobbletone-fx-${fingerprint()}`;

const src = readFileSync(SW, 'utf8');
const LINE = /^const CACHE_VERSION = "(.*)";$/m;
const found = src.match(LINE);
if (!found) {
  console.error('stamp-sw: no `const CACHE_VERSION = "...";` line in service-worker.js');
  process.exit(2);
}

if (found[1] === wanted) {
  console.log(`stamp-sw: up to date (${wanted})`);
  process.exit(0);
}

if (process.argv.includes('--check')) {
  console.error(`stamp-sw: cache name is stale.\n  is:     ${found[1]}\n  should: ${wanted}\nRun \`npm run stamp\` and commit the result.`);
  process.exit(1);
}

writeFileSync(SW, src.replace(LINE, `const CACHE_VERSION = "${wanted}";`));
console.log(`stamp-sw: ${found[1]} -> ${wanted}`);

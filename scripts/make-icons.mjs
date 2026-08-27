// Generates PWA icons from icons/icon.svg using sips on macOS.
// Writes: icon-192.png, icon-512.png, icon-512-maskable.png, favicon-32.png, apple-touch-icon.png
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'icons');
mkdirSync(OUT, { recursive: true });

const SRC_SVG = join(OUT, 'icon.svg');
const svg = readFileSync(SRC_SVG, 'utf-8');

function writePng(svgStr, name, size) {
  const svgPath = `/tmp/wobbletonefx-${name}.svg`;
  const pngPath = join(OUT, `${name}.png`);
  writeFileSync(svgPath, svgStr);
  try {
    execSync(`sips -s format png -z ${size} ${size} "${svgPath}" --out "${pngPath}"`, { stdio: 'pipe' });
    console.log(`wrote ${pngPath}`);
  } catch {
    console.warn(`sips failed for ${name}; SVG left at ${svgPath}`);
  }
}

// Maskable variant: add padding so content sits in the central 80% safe zone.
function maskableSvg(size) {
  // The existing icon.svg already has a full-bleed background rect.
  // For maskable, we scale the content down to 80% and center it.
  const inner = svg.replace(/viewBox="0 0 512 512"/, `viewBox="0 0 ${size} ${size}"`);
  return inner.replace(
    /(<rect width="512" height="512" rx="96" fill="#0a0a0f"\/>)/,
    `<rect width="${size}" height="${size}" fill="#0a0a0f"/>`
  ).replace(
    /(<circle cx="200" cy="180" r="120" fill="url\(#g\)" opacity="0\.95"\/>)/,
    `<g transform="translate(${size * 0.1}, ${size * 0.1}) scale(${size / 512 * 0.8})">$1`
  ).replace(
    /(<rect x="250" y="160" width="180" height="180" rx="28" fill="#1a1a2e" opacity="0\.85"\/>)/,
    `$1`
  ).replace(
    /(<circle cx="200" cy="180" r="120" fill="url\(#g\)" opacity="0\.4" filter="url\(#blur\)\"\/>)/,
    `$1</g>`
  ).replace(
    /(<text x="256" y="430"[^>]*>◐<\/text>)/,
    `<text x="${size / 2}" y="${size * 0.84}" font-family="system-ui,sans-serif" font-size="${size * 0.125}" font-weight="800" fill="#e8e8f0" text-anchor="middle">◐</text>`
  );
}

writePng(svg, 'icon-192', 192);
writePng(svg, 'icon-512', 512);
writePng(maskableSvg(512), 'icon-512-maskable', 512);
writePng(svg, 'favicon-32', 32);
writePng(svg, 'apple-touch-icon', 180);

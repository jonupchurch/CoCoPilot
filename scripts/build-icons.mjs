import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Resvg } from '@resvg/resvg-js';
import pngToIco from 'png-to-ico';

/**
 * Rasterise the brand mark into the icons the application ships.
 *
 * **Run by hand, not by the build.** The output is committed, so publishing
 * needs no rasteriser and a release cannot fail on a native dependency that
 * happens not to build on the release machine. The cost is that the icons can
 * drift from the SVG; the fix is running this after changing the art, which is
 * the only time it is wrong.
 *
 *   node scripts/build-icons.mjs
 *
 * Two formats, because the platforms genuinely differ:
 *
 *   - `icon.ico` — Windows. The taskbar and the window title bar pick different
 *     sizes out of the same file, so a single PNG scaled by the compositor
 *     looks soft at exactly the size the user stares at most.
 *   - `icon.png` — Linux's window icon, and macOS's dock icon, which is set at
 *     runtime because an unbundled Electron has no `.icns` to read.
 */

const root = fileURLToPath(new URL('..', import.meta.url));
const source = join(root, 'resources', 'cocoapilot-mark.svg');
const outDir = join(root, 'apps', 'board', 'resources');

/**
 * The sizes Windows actually selects between. 256 is the ceiling the ICO
 * format stores as PNG rather than a bitmap, and the largest Explorer uses.
 */
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

/** Large enough for a Retina dock icon, which is drawn at 2x of 512. */
const PNG_SIZE = 1024;

const svg = readFileSync(source, 'utf8');

/** @param {number} size */
function render(size) {
  // `fitTo` by width rather than a transform: the mark is square by viewBox, and
  // letting resvg do the scaling keeps the strokes crisp instead of resampling a
  // single large raster down to 16px, where the centre line would disappear.
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
}

mkdirSync(outDir, { recursive: true });

const png = render(PNG_SIZE);
writeFileSync(join(outDir, 'icon.png'), png);
process.stdout.write(`icon.png     ${PNG_SIZE}x${PNG_SIZE}  ${png.length} bytes\n`);

const ico = await pngToIco(ICO_SIZES.map(render));
writeFileSync(join(outDir, 'icon.ico'), ico);
process.stdout.write(`icon.ico     ${ICO_SIZES.join(', ')}  ${ico.length} bytes\n`);

process.stdout.write(`\nWrote both from ${source}\n`);

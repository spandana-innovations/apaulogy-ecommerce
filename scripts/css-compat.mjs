/* Post-build CSS down-levelling for older mobile browsers.
 *
 * Tailwind v4 emits modern CSS whose baseline is Safari 16.4+ / Chrome 111+.
 * On iOS 15–16.3 and older Android the native `@layer` rules were dropped
 * wholesale, so those phones rendered the storefront unstyled/broken while
 * newer phones were fine ("loads on some phones, not others").
 *
 * This pass rewrites the compiled CSS with postcss-preset-env so that:
 *   - cascade layers (@layer) are flattened into specificity-equivalent rules,
 *   - vendor prefixes are added (autoprefixer), and
 *   - other modern features get fallbacks where a static one exists.
 * Dynamic color-mix()/@property tints that can't be pre-computed stay behind
 * Tailwind's own @supports guards, so they simply no-op on old engines instead
 * of breaking the page.
 */
import postcss from 'postcss';
import presetEnv from 'postcss-preset-env';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const DIST = 'dist';
const BROWSERS = 'Safari >= 13, iOS >= 13, Chrome >= 80, Firefox >= 80, Android >= 7, Samsung >= 10, not dead, > 0.2%';

async function* cssFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* cssFiles(p);
    else if (entry.name.endsWith('.css')) yield p;
  }
}

const processor = postcss([
  presetEnv({
    browsers: BROWSERS,
    features: { 'cascade-layers': true },
    enableClientSidePolyfills: false,
  }),
]);

let n = 0, hadLayers = 0;
for await (const file of cssFiles(DIST)) {
  const css = await readFile(file, 'utf8');
  if (!css) continue;
  const before = css.includes('@layer');
  const res = await processor.process(css, { from: file, to: file });
  await writeFile(file, res.css);
  n++;
  if (before && !res.css.includes('@layer')) hadLayers++;
}
console.log(`[css-compat] processed ${n} stylesheet(s); flattened cascade layers in ${hadLayers}.`);

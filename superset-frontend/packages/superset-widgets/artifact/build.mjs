/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// Builds the widgets bundle for backend-less hosts (Claude artifacts):
// - dist/superset-widgets.min.js: React and the widgets in one IIFE that sets
//   window.SupersetWidgets and injects its own CSS. No separate assets, no
//   font files (the session API loads fonts from Google Fonts), no dynamic
//   imports, so it can be served from a CDN or inlined.
// - dist/examples/inline.html: examples/inline.html with the bundle inlined.
// - dist/examples/cdn.html: examples/cdn.html pointing at SUPERSET_WIDGETS_URL,
//   only when that variable is set.
// Run: node artifact/build.mjs
import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const packages = fileURLToPath(new URL('../..', import.meta.url));
const distDir = join(here, 'dist');
const bundleDir = join(distDir, 'bundle');
const pkg = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);

// Vite and its plugins are installed once, in the example app.
const fromExample = createRequire(
  new URL('../example/package.json', import.meta.url),
);
const importFromExample = async name => {
  let mod = await import(pathToFileURL(fromExample.resolve(name)).href);
  // A CommonJS build arrives as {default: module.exports}, which may itself
  // be {default: plugin}.
  while (typeof mod !== 'function' && mod?.default) mod = mod.default;
  return mod;
};
const { build } = await import(
  pathToFileURL(
    join(
      dirname(fromExample.resolve('vite/package.json')),
      'dist/node/index.js',
    ),
  ).href
);
const react = await importFromExample('@vitejs/plugin-react');
const svgr = await importFromExample('vite-plugin-svgr');
const emotionBabelPlugin = createRequire(import.meta.url).resolve(
  '@emotion/babel-plugin',
);

// Superset's theme imports @fontsource CSS, which would inline ~1.5 MB of
// base64 font files into the bundle.
const NO_FONT_FILES = '\0superset-widgets-no-font-files';
const skipFontFiles = {
  name: 'superset-widgets-skip-font-files',
  enforce: 'pre',
  resolveId: id => (id.startsWith('@fontsource/') ? NO_FONT_FILES : null),
  load: id => (id === NO_FONT_FILES ? 'export {};' : null),
};

// AsyncIcon's webpack-only `import('!!@svgr/webpack!...')` cannot resolve in a
// single file; such icons render empty instead of failing at runtime.
const noAsyncIcons = {
  name: 'superset-widgets-no-async-icons',
  enforce: 'pre',
  transform(code, id) {
    if (!id.endsWith('/Icons/AsyncIcon.tsx')) return null;
    const next = code.replace(
      /import\(\s*`!!@svgr\/webpack![^`]*`\s*\)/,
      'Promise.resolve({ default: () => null })',
    );
    if (next === code) throw new Error('AsyncIcon dynamic import not found');
    return next;
  },
};

await build({
  configFile: false,
  root: here,
  logLevel: 'warn',
  plugins: [
    skipFontFiles,
    noAsyncIcons,
    react({
      jsxImportSource: '@emotion/react',
      babel: { plugins: [emotionBabelPlugin] },
    }),
    svgr({ include: '**/*.svg', svgrOptions: { exportType: 'default' } }),
  ],
  define: {
    __SUPERSET_WIDGETS_VERSION__: JSON.stringify(pkg.version),
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env.WEBPACK_MODE': JSON.stringify('production'),
    'process.env.SCARF_ANALYTICS': JSON.stringify('false'),
    global: 'globalThis',
  },
  resolve: {
    alias: [
      {
        find: /^@apache-superset\/core$/,
        replacement: `${packages}superset-core/src/index.ts`,
      },
      {
        find: /^@apache-superset\/core\/(.*)$/,
        replacement: `${packages}superset-core/src/$1`,
      },
      {
        find: /^@superset-ui\/core$/,
        replacement: `${packages}superset-ui-core/src/index.ts`,
      },
      {
        find: /^@superset-ui\/core\/(.*)$/,
        replacement: `${packages}superset-ui-core/src/$1`,
      },
    ],
    dedupe: ['react', 'react-dom', '@emotion/react', 'antd'],
  },
  build: {
    outDir: bundleDir,
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
    cssCodeSplit: false,
    // Artifacts cannot fetch anything, so any remaining asset becomes a data URI.
    assetsInlineLimit: () => true,
    chunkSizeWarningLimit: 16_000,
    lib: {
      entry: join(here, 'entry.ts'),
      name: 'SupersetWidgetsBundle',
      formats: ['iife'],
      fileName: () => 'superset-widgets.js',
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});

const files = await readdir(bundleDir);
const extra = files.filter(file => !/\.(js|css)$/.test(file));
if (extra.length) {
  throw new Error(`Bundle emitted non-inlined files: ${extra.join(', ')}`);
}
const js = await readFile(join(bundleDir, 'superset-widgets.js'), 'utf8');
const css = (
  await Promise.all(
    files
      .filter(file => file.endsWith('.css'))
      .map(file => readFile(join(bundleDir, file), 'utf8')),
  )
).join('\n');

// Artifacts allow no stylesheet hosts but Google Fonts, so CSS travels in the JS.
const injectCss = css.trim()
  ? `(function(){if(typeof document==="undefined")return;var s=document.createElement("style");s.setAttribute("data-superset-widgets","");s.textContent=${JSON.stringify(css)};document.head.appendChild(s);})();\n`
  : '';
const bundle = `/*! @apache-superset/widgets ${pkg.version} | Apache-2.0 */\n${injectCss}${js}`;

await mkdir(join(distDir, 'examples'), { recursive: true });
const bundlePath = join(distDir, 'superset-widgets.min.js');
await writeFile(bundlePath, bundle);
await rm(bundleDir, { recursive: true, force: true });
await rm(join(distDir, 'widgets-artifact.html'), { force: true });

// Keep the inlined code from closing its own <script> element early.
const inlineSafe = bundle
  .replace(/<\/script/gi, '<\\/script')
  .replace(/<!--/g, '<\\!--');
const JS_MARKER = '<!-- SUPERSET_WIDGETS_JS -->';
const inlineTemplate = await readFile(
  join(here, 'examples', 'inline.html'),
  'utf8',
);
if (!inlineTemplate.includes(JS_MARKER)) {
  throw new Error(`examples/inline.html is missing ${JS_MARKER}`);
}
const inlinePath = join(distDir, 'examples', 'inline.html');
await writeFile(
  inlinePath,
  inlineTemplate.replace(JS_MARKER, () => `<script>${inlineSafe}</script>`),
);

const outputs = [bundlePath, inlinePath];
const bundleUrl = process.env.SUPERSET_WIDGETS_URL;
if (bundleUrl) {
  if (!/^https:\/\//.test(bundleUrl)) {
    throw new Error('SUPERSET_WIDGETS_URL must be an https:// URL');
  }
  const cdnTemplate = await readFile(join(here, 'examples', 'cdn.html'), 'utf8');
  const cdnPath = join(distDir, 'examples', 'cdn.html');
  await writeFile(
    cdnPath,
    cdnTemplate.replaceAll('{{SUPERSET_WIDGETS_URL}}', bundleUrl),
  );
  outputs.push(cdnPath);
}

const mb = bytes => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
const dynamicImports = (js.match(/\bimport\(/g) ?? []).length;
if (dynamicImports) {
  throw new Error(`Bundle still contains ${dynamicImports} dynamic import(s)`);
}
for (const output of outputs) {
  const size = Buffer.byteLength(await readFile(output));
  console.log(`${output} ${mb(size)}`);
}
console.log(
  `css injected ${mb(Buffer.byteLength(css))}; no dynamic imports`,
);

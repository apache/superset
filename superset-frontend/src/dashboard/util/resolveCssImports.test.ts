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
import fetchMock from 'fetch-mock';
import { hasCssImport, resolveCssImports } from './resolveCssImports';

afterEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
});

test('hasCssImport detects @import case-insensitively', () => {
  expect(hasCssImport('')).toBe(false);
  expect(hasCssImport('.header { color: red; }')).toBe(false);
  expect(hasCssImport("@import url('https://fonts.example.com/x.css');")).toBe(
    true,
  );
  expect(hasCssImport("@IMPORT url('https://fonts.example.com/x.css');")).toBe(
    true,
  );
});

test('leaves css without @import untouched and fetches nothing', async () => {
  const css = '.header { color: red; }';
  const result = await resolveCssImports(css);

  expect(result).toEqual({ css, resolvedCount: 0, unresolvedUrls: [] });
});

test('replaces a Google-Fonts-style @import with the fetched @font-face rules', async () => {
  const fontUrl = 'https://fonts.googleapis.com/css2?family=Inter';
  const fontCss =
    "@font-face { font-family: 'Inter'; src: url('https://fonts.gstatic.com/s/inter/x.woff2') format('woff2'); }";
  fetchMock.get(fontUrl, {
    status: 200,
    body: fontCss,
    headers: { 'content-type': 'text/css; charset=utf-8' },
  });

  const result = await resolveCssImports(
    `.header { color: red; }\n@import url('${fontUrl}');`,
  );

  expect(result.resolvedCount).toBe(1);
  expect(result.unresolvedUrls).toEqual([]);
  expect(result.css).not.toMatch(/@import/i);
  expect(result.css).toContain('font-family');
  expect(result.css).toContain('fonts.gstatic.com');
});

test('rebases a relative url() in the fetched stylesheet against the import URL', async () => {
  const fontUrl = 'https://fonts.example.com/css2?family=Inter';
  const fontCss =
    "@font-face { font-family: 'Inter'; src: url('../fonts/font.woff2') format('woff2'); }";
  fetchMock.get(fontUrl, {
    status: 200,
    body: fontCss,
    headers: { 'content-type': 'text/css; charset=utf-8' },
  });

  const result = await resolveCssImports(`@import url('${fontUrl}');`);

  expect(result.resolvedCount).toBe(1);
  expect(result.css).toContain(
    "url('https://fonts.example.com/fonts/font.woff2')",
  );
});

test('leaves absolute, protocol-relative, and data urls in the fetched stylesheet untouched', async () => {
  const cssUrl = 'https://cdn.example.com/theme/base.css';
  const fetchedCss = [
    ".a { background: url('https://other.example.com/img/a.png'); }",
    ".b { background: url('//other.example.com/img/b.png'); }",
    ".c { background: url('data:image/png;base64,AAAA'); }",
  ].join('\n');
  fetchMock.get(cssUrl, {
    status: 200,
    body: fetchedCss,
    headers: { 'content-type': 'text/css; charset=utf-8' },
  });

  const result = await resolveCssImports(`@import url('${cssUrl}');`);

  expect(result.css).toContain("url('https://other.example.com/img/a.png')");
  expect(result.css).toContain("url('//other.example.com/img/b.png')");
  expect(result.css).toContain("url('data:image/png;base64,AAAA')");
});

test('leaves an @import unresolved and reports it when the fetch fails', async () => {
  const brokenUrl = 'https://no-cors.example.com/branding.css';
  fetchMock.get(brokenUrl, { throws: new TypeError('Failed to fetch') });

  const result = await resolveCssImports(`@import url('${brokenUrl}');`);

  expect(result.resolvedCount).toBe(0);
  expect(result.unresolvedUrls).toEqual([brokenUrl]);
  expect(result.css).toContain('@import');
});

test('leaves an @import unresolved when the response is not CSS', async () => {
  const url = 'https://example.com/not-css.html';
  fetchMock.get(url, {
    status: 200,
    body: '<html></html>',
    headers: { 'content-type': 'text/html' },
  });

  const result = await resolveCssImports(`@import url('${url}');`);

  expect(result.resolvedCount).toBe(0);
  expect(result.unresolvedUrls).toEqual([url]);
});

test('resolves one @import and reports another it could not fetch', async () => {
  const goodUrl = 'https://fonts.googleapis.com/css2?family=Inter';
  const badUrl = 'https://no-cors.example.com/branding.css';
  fetchMock.get(goodUrl, {
    status: 200,
    body: "@font-face { font-family: 'Inter'; src: url('x.woff2'); }",
    headers: { 'content-type': 'text/css' },
  });
  fetchMock.get(badUrl, { throws: new TypeError('Failed to fetch') });

  const result = await resolveCssImports(
    `@import url('${goodUrl}');\n@import url('${badUrl}');`,
  );

  expect(result.resolvedCount).toBe(1);
  expect(result.unresolvedUrls).toEqual([badUrl]);
  expect(result.css).toContain('font-family');
  expect(result.css).toContain('@import');
  expect(result.css).toContain(badUrl);
});

test('preserves a media condition by wrapping the inlined rules in @media', async () => {
  const printUrl = 'https://cdn.example.com/print.css';
  fetchMock.get(printUrl, {
    status: 200,
    body: '.report { font-size: 10pt; }',
    headers: { 'content-type': 'text/css' },
  });

  const result = await resolveCssImports(`@import url('${printUrl}') print;`);

  expect(result.resolvedCount).toBe(1);
  expect(result.css).not.toMatch(/@import/i);
  expect(result.css).toContain('@media print');
  expect(result.css).toContain('.report');
});

test('preserves layer, supports, and media conditions with spec-order nesting', async () => {
  const url = 'https://cdn.example.com/grid.css';
  fetchMock.get(url, {
    status: 200,
    body: '.grid { display: grid; }',
    headers: { 'content-type': 'text/css' },
  });

  const result = await resolveCssImports(
    `@import url('${url}') layer(base) supports(display: grid) screen;`,
  );

  expect(result.resolvedCount).toBe(1);
  expect(result.css).not.toMatch(/@import/i);
  // Nesting mirrors the @import's semantics: media outermost, then
  // supports, then layer around the imported rules.
  const mediaIdx = result.css.indexOf('@media screen');
  const supportsIdx = result.css.indexOf('@supports (display: grid)');
  const layerIdx = result.css.indexOf('@layer base');
  const ruleIdx = result.css.indexOf('.grid');
  expect(mediaIdx).toBeGreaterThanOrEqual(0);
  expect(supportsIdx).toBeGreaterThan(mediaIdx);
  expect(layerIdx).toBeGreaterThan(supportsIdx);
  expect(ruleIdx).toBeGreaterThan(layerIdx);
});

test('does not resolve an @import nested inside a fetched stylesheet', async () => {
  const outerUrl = 'https://fonts.googleapis.com/css2?family=Inter';
  const innerCss = "@import url('https://example.com/nested.css');";
  fetchMock.get(outerUrl, {
    status: 200,
    body: innerCss,
    headers: { 'content-type': 'text/css' },
  });

  const result = await resolveCssImports(`@import url('${outerUrl}');`);

  // The outer @import was successfully fetched and replaced, but its
  // content is inlined as-is, including the @import it itself contains --
  // that one is left for the backend validator to reject on save, same as
  // any hand-typed @import.
  expect(result.resolvedCount).toBe(1);
  expect(result.css).toContain('@import');
  expect(result.css).toContain('nested.css');
});

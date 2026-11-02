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
import type { AtRule } from 'postcss';

// Mirrors the "@import" entry of _DANGEROUS_CSS_PATTERNS in
// superset/dashboards/schemas.py's validate_css. This only decides whether
// to offer the "convert @import" action below -- the backend validator is
// the actual gate on save either way, so keeping this exactly in sync is a
// UX nicety, not a security requirement.
const CSS_IMPORT_PATTERN = /@import\b/i;

export function hasCssImport(css: string): boolean {
  return CSS_IMPORT_PATTERN.test(css);
}

export interface ResolveCssImportsResult {
  css: string;
  resolvedCount: number;
  unresolvedUrls: string[];
}

/**
 * Splits an `@import` at-rule's raw params into the URL and whatever
 * trails it (layer/supports/media conditions), e.g.
 * `url('https://fonts.googleapis.com/css2?family=Inter') screen` or
 * `"https://example.com/x.css"`. Returns null for a params string this
 * can't confidently pull a URL out of.
 */
function parseImportParams(
  params: string,
): { url: string; conditionsRaw: string } | null {
  const trimmed = params.trim();
  const match = trimmed.match(
    /^url\(\s*['"]?([^'")]+)['"]?\s*\)|^['"]([^'"]+)['"]/i,
  );
  const url = match?.[1] ?? match?.[2];
  if (!match || !url) {
    return null;
  }
  return { url, conditionsRaw: trimmed.slice(match[0].length).trim() };
}

/**
 * Reads a balanced `(...)` group starting at `openIdx` (which must point at
 * the opening paren). Returns the content between the parens and the index
 * of the closing paren, or null if the parens never balance.
 */
function readBalanced(
  str: string,
  openIdx: number,
): { content: string; end: number } | null {
  let depth = 0;
  for (let i = openIdx; i < str.length; i += 1) {
    if (str[i] === '(') {
      depth += 1;
    } else if (str[i] === ')') {
      depth -= 1;
      if (depth === 0) {
        return { content: str.slice(openIdx + 1, i), end: i };
      }
    }
  }
  return null;
}

interface ImportConditions {
  /** Layer name; empty string for the anonymous `layer` keyword. */
  layer: string | null;
  supports: string | null;
  media: string | null;
}

/**
 * Parses the conditions that may trail an `@import` URL, in their
 * spec-defined order: an optional `layer`/`layer(name)`, an optional
 * `supports(...)`, then a media query list. Returns null when the string
 * can't be parsed confidently (e.g. unbalanced parens), so the caller can
 * leave the rule alone rather than guess at its meaning.
 */
function parseImportConditions(raw: string): ImportConditions | null {
  let rest = raw.trim().replace(/;\s*$/, '');
  const conditions: ImportConditions = {
    layer: null,
    supports: null,
    media: null,
  };

  if (/^layer\(/i.test(rest)) {
    const group = readBalanced(rest, 'layer'.length);
    if (!group) {
      return null;
    }
    conditions.layer = group.content.trim();
    rest = rest.slice(group.end + 1).trim();
  } else if (/^layer(\s|$)/i.test(rest)) {
    conditions.layer = '';
    rest = rest.slice('layer'.length).trim();
  }

  if (/^supports\(/i.test(rest)) {
    const group = readBalanced(rest, 'supports'.length);
    if (!group) {
      return null;
    }
    conditions.supports = group.content.trim();
    rest = rest.slice(group.end + 1).trim();
  }

  conditions.media = rest || null;
  return conditions;
}

// Matches CSS `url(...)` function calls, optionally quoted, e.g.
// `url(../fonts/font.woff2)`, `url('img/bg.png')`, `url("./x.svg")`.
const CSS_URL_PATTERN = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;

/**
 * Rewrites relative `url(...)` references in a fetched stylesheet (font,
 * image, and other asset paths) so they resolve against the stylesheet's
 * own URL instead of the dashboard document. Without this, an imported
 * stylesheet like `@import url('https://fonts.example.com/css2')` whose
 * body contains `url(../fonts/font.woff2)` would, once inlined verbatim,
 * resolve that relative path against the dashboard's own origin and fail
 * to load. Absolute URLs, protocol-relative URLs, and data URIs are left
 * untouched.
 */
function rebaseCssUrls(css: string, baseUrl: string): string {
  return css.replace(CSS_URL_PATTERN, (match, quote, rawUrl) => {
    const url = rawUrl.trim();
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|data:)/i.test(url)) {
      return match;
    }
    try {
      const rebased = new URL(url, baseUrl).toString();
      return `url(${quote}${rebased}${quote})`;
    } catch {
      return match;
    }
  });
}

/**
 * Replaces every top-level `@import url(...)` in `css` with the fetched
 * target stylesheet's own contents, so the result can be saved without
 * tripping the backend's `@import` rejection. The fetch happens in the
 * caller's own browser, not on the Superset backend, so this carries none
 * of the SSRF risk a server-side fetch of an editor-supplied URL would --
 * and every dashboard viewer's browser already fetches the same URL today
 * whenever `@import`-ing CSS renders, so this isn't new exposure, only a
 * one-time version of exposure that already happens on every view.
 *
 * An `@import` whose target can't be fetched (CORS, network error, a
 * non-2xx response, or a response that isn't CSS) is left untouched in the
 * output and reported in `unresolvedUrls`, rather than silently dropped, so
 * a save attempt still fails with a clear reason and nothing is lost.
 *
 * An `@import`'s layer/supports/media conditions (e.g.
 * `@import url('print.css') print`) are preserved by wrapping the inlined
 * stylesheet in the equivalent `@layer`/`@supports`/`@media` blocks, so
 * conditional imports keep applying under the same conditions.
 *
 * Only one level of `@import` is resolved: an `@import` found inside a
 * fetched stylesheet is not itself fetched, and is carried through to the
 * merged output as-is aside from having its own `url(...)` rebased against
 * the parent stylesheet (the same rebasing every other relative URL in that
 * stylesheet gets). A save with a remaining `@import` still fails backend
 * validation exactly as before -- there is no security reliance on this
 * function fully resolving anything, only a UX convenience for the common
 * case (a single Google-Fonts-style `@import` resolving to a handful of
 * `@font-face` rules).
 */
export async function resolveCssImports(
  css: string,
): Promise<ResolveCssImportsResult> {
  if (!hasCssImport(css)) {
    return { css, resolvedCount: 0, unresolvedUrls: [] };
  }

  const postcss = (await import('postcss')).default;
  const root = postcss.parse(css);
  const importRules = root.nodes.filter(
    (node): node is AtRule =>
      node.type === 'atrule' && node.name.toLowerCase() === 'import',
  );

  let resolvedCount = 0;
  const unresolvedUrls: string[] = [];

  await Promise.all(
    importRules.map(async rule => {
      const parsed = parseImportParams(rule.params);
      if (!parsed) {
        unresolvedUrls.push(rule.params);
        return;
      }
      const { url } = parsed;
      // An @import's layer/supports/media conditions must survive the
      // conversion (e.g. `@import url('print.css') print` must not start
      // applying on screen), so the fetched rules get wrapped in the
      // equivalent block form below. Conditions we can't parse mean we
      // leave the rule alone rather than change what it applies to.
      const conditions = parseImportConditions(parsed.conditionsRaw);
      if (!conditions) {
        unresolvedUrls.push(url);
        return;
      }
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Fetching ${url} returned HTTP ${response.status}`);
        }
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType && !contentType.includes('css')) {
          throw new Error(`${url} did not return a CSS response`);
        }
        const importedCss = rebaseCssUrls(await response.text(), url);
        const importedRoot = postcss.parse(importedCss);
        // Wrap innermost-first (layer, then supports, then media) so the
        // block nesting mirrors the @import's own semantics:
        // @media { @supports { @layer { ...imported rules... } } }.
        let replacement = importedRoot.nodes;
        if (conditions.layer !== null) {
          const layerRule = postcss.atRule({
            name: 'layer',
            params: conditions.layer,
          });
          layerRule.append(replacement);
          replacement = [layerRule];
        }
        if (conditions.supports !== null) {
          const supportsRule = postcss.atRule({
            name: 'supports',
            // A bare declaration like `display: grid` needs wrapping
            // parens to be a valid @supports condition; a condition that
            // already starts with `(` or `not` is valid as-is.
            params: /^\(|^not\s/i.test(conditions.supports)
              ? conditions.supports
              : `(${conditions.supports})`,
          });
          supportsRule.append(replacement);
          replacement = [supportsRule];
        }
        if (conditions.media !== null) {
          const mediaRule = postcss.atRule({
            name: 'media',
            params: conditions.media,
          });
          mediaRule.append(replacement);
          replacement = [mediaRule];
        }
        rule.replaceWith(replacement);
        resolvedCount += 1;
      } catch {
        // Most commonly a CORS rejection: fetch() can't read the response
        // body from a server that doesn't opt in with CORS headers, even
        // though the browser's own CSS engine can load that same URL
        // natively via @import. Left unresolved rather than guessed at.
        unresolvedUrls.push(url);
      }
    }),
  );

  return { css: root.toString(), resolvedCount, unresolvedUrls };
}

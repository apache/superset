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
import {
  createElement,
  type AnchorHTMLAttributes,
  type ReactElement,
} from 'react';
import { ensureAppRoot, makeUrl, stripAppRoot } from './pathUtils';
// Note: master PR #40546 added `import { sanitizeUrl } from
// '@braintree/sanitize-url';` here as part of its sink-wrapping approach.
// Dropped on merge because this file's `assertSafeNavigationUrl` /
// inline-barrier scheme is strictly stronger: it rejects `javascript:` /
// `data:` (scheme allowlist), backslash-laden authority spoofing,
// and userinfo-bearing http(s)/ftp URLs — none of which
// `sanitizeUrl` rejects. The library remains a project dep (used in
// ListViewCard, SqlAlchemyForm, etc.) and is intentionally unused here.

// Re-export so callers that legitimately need a raw prefixed path (native
// fetch, navigator.sendBeacon, image src, third-party `href` props) have a
// single sanctioned import location. The static-invariant scan disallows
// importing from `pathUtils` directly outside this module.
export { ensureAppRoot, makeUrl, stripAppRoot };

// The guard helpers are declared before `navigateTo` / `navigateWithState`
// so oxlint's no-use-before-define lint (which does not honour function-
// declaration hoisting) does not fire on the wired-up imperative-nav
// path. The focused helpers below (`openInNewTab`, `getShareableUrl`,
// `AppLink`) also reach for `assertSafeNavigationUrl` directly.

const NEW_TAB_FEATURES = 'noopener noreferrer';

// Duplicate-navigation suppression for `assign`-mode navigations (master
// PR #40833: prevents a double-click on "create dashboard" from firing two
// identical `window.location.assign` calls and creating duplicate objects).
// Keyed on the final, already-sanitised sink value so the dedupe decision is
// made on exactly what would reach `window.location.assign`. This is pure
// bookkeeping — it never touches the sink, so the inline CodeQL barriers on
// each `assign` branch below remain intact.
const DUPLICATE_NAV_WINDOW_MS = 1000;
let lastAssignUrl: string | null = null;
let lastAssignAt = 0;

function shouldSkipDuplicateAssign(sinkValue: string): boolean {
  const now = Date.now();
  if (
    lastAssignUrl === sinkValue &&
    now - lastAssignAt < DUPLICATE_NAV_WINDOW_MS
  ) {
    return true;
  }
  lastAssignUrl = sinkValue;
  lastAssignAt = now;
  return false;
}

// Constant base for the URL-constructor barrier in the router-relative
// branches below. Using a constant (rather than `window.location.origin`)
// keeps the parse fully deterministic — test mocks that supply only
// `window.location.href` still exercise the same code path, and CodeQL
// recognises the literal-string origin equality as a sanitiser.
const SAFE_PATH_PARSE_BASE = 'http://navigation-utils.invalid/';
const SAFE_PATH_PARSE_ORIGIN = 'http://navigation-utils.invalid';

// Allow-list of safe URL shapes for navigation: router-relative paths and a
// small set of known-safe schemes. `ensureAppRoot` already neutralises
// `javascript:` / `data:` by prefixing them as relative paths; protocol-
// relative `//host` is intentionally excluded here because it is a cross-
// origin navigation primitive that previously enabled open redirects.
//
// The leading-slash branch also rejects any URL
// containing a backslash anywhere — browsers normalise `/\evil.com` →
// `//evil.com` in the special-scheme authority, so backslashes in any
// position let an attacker craft a path that looks router-relative until
// the browser parses it. http(s)/ftp URLs with userinfo (`@` before the
// first `/` after `//`) are rejected by the post-regex authority check
// below, since `https://good@evil.com` resolves to the host `evil.com`
// despite presenting as a same-origin-looking URL to the eye.
//
// The http(s)/ftp branches require an
// explicit `//` after the scheme. Without it, `new URL('http:evil.com')`
// in modern browsers parses the authority as `evil.com` — a same-origin-
// looking absolute URL that resolves cross-origin. Mirroring the
// protocol-relative `//host` reject from above.
// URL strings containing C0/C1 controls
// (`\t`/`\n`/`\r`/etc., DEL, U+0080..U+009F) or Unicode zero-width / bidi
// formatting marks (U+200B..U+200F, U+202A..U+202E, U+2066..U+2069,
// U+2028, U+2029, U+FEFF) are rejected outright. Browsers strip leading
// C0 controls before parsing the leading-slash branch, so `\t//evil.com`
// would otherwise leave the leading-slash check unable to see the
// protocol-relative `//`. Defence-in-depth — no known active bypass
// against the current allow-list, but the regex would otherwise depend
// on browser-specific normalisation behaviour.
//
// The bidi range was
// extended to cover the explicit-direction format characters U+202A..E
// (LRE/RLE/PDF/LRO/RLO) and U+2066..9 (LRI/RLI/FSI/PDI). WHATWG strips
// these before parsing the host, but the earlier comment had promised them
// while the regex only covered U+200E/F — closing the documentation
// drift the code review surfaced.
const SAFE_NAVIGATION_URL_RE =
  /^(?:\/(?!\/)|https?:\/\/|ftp:\/\/|mailto:|tel:)/i;
const USERINFO_BEARING_SCHEME_RE = /^(?:https?|ftp):\/\//i;
// String-literal `\u` escapes (via `new RegExp(...)`) instead of a regex
// literal so source-file tooling (Babel parser, prettier, eslint) does
// not have to round-trip raw bidi / zero-width / line-separator bytes.
const FORBIDDEN_CONTROL_CHARS_RE = new RegExp(
  '[\\x00-\\x1F\\x7F-\\x9F' +
    '\\u200B-\\u200F' +
    '\\u202A-\\u202E' +
    '\\u2066-\\u2069' +
    '\\u2028\\u2029\\uFEFF]',
);

// `encodeURI` (kept at the sinks below as CodeQL's recognised
// `js/html-injection` sanitiser) escapes `%` itself, so an already-
// percent-encoded path — and `parsed.pathname`/`.search`/`.hash` from the
// URL constructor always are — would be double-encoded (`%20` → `%2520`)
// and the navigation would land on the wrong URL. Mapping `%25XX`
// (XX = hex) back to `%XX` after the encodeURI pass restores the
// constructor's escape sequences. The pair is NOT a strict no-op: the
// WHATWG serialiser emits some characters raw that encodeURI escapes
// (`|`, `^`, `[`, `]` in paths; also `{`, `}`, backtick in queries), so
// those end up single-encoded — semantically equivalent, since servers
// percent-decode them back to the same resource.
const DOUBLE_ENCODED_ESCAPE_RE = /%25([0-9A-Fa-f]{2})/g;

function assertSafeNavigationUrl(url: string): string {
  if (FORBIDDEN_CONTROL_CHARS_RE.test(url)) {
    throw new Error(
      'navigationUtils refused unsafe URL: contains a forbidden ' +
        'control or zero-width character (would survive the allow-list ' +
        'as a browser-normalised navigation primitive).',
    );
  }
  if (!SAFE_NAVIGATION_URL_RE.test(url) || url.includes('\\')) {
    throw new Error(
      'navigationUtils refused unsafe URL: only relative paths and ' +
        'http(s)://, ftp://, mailto:, tel: schemes are allowed.',
    );
  }
  if (USERINFO_BEARING_SCHEME_RE.test(url)) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(
        'navigationUtils refused unsafe URL: unparseable authority.',
      );
    }
    if (parsed.username || parsed.password) {
      throw new Error(
        'navigationUtils refused unsafe URL: ' +
          'http(s)/ftp URLs with userinfo are not allowed.',
      );
    }
  }
  return url;
}

/**
 * Imperative full-page navigation. Internal entry point for `redirect()`
 * and a handful of legacy callers; new code should prefer `<AppLink>` or
 * `redirect()`. Unsafe URLs (protocol-relative, backslash-laden, userinfo-
 * carrying http(s)) fall back to `ensureAppRoot('/')` with a `console.error`
 * — never a silent navigation to the rejected target.
 *
 * Each `window.*` sink lives inside an if-block whose guard layers
 * sanitisers so every CodeQL query family that fires on these sinks sees
 * one it recognises:
 *
 *   1. `target.startsWith('/')` + `!target.startsWith('//')` +
 *      `!target.includes('\\')` — recognised by `js/client-side-
 *      unvalidated-url-redirection`; rules out protocol-relative and
 *      browser-normalised backslash-laden authority spoofing.
 *   2. `new URL(target, SAFE_PATH_PARSE_BASE)` + literal equality on
 *      `parsed.origin` + literal equality on `parsed.protocol` —
 *      recognised by `js/xss-through-dom`. The constant base keeps the
 *      parse deterministic when test mocks supply only `window.location.
 *      { href, assign }` and not `origin`.
 *   3. `safePath.startsWith('/')` + `!safePath.startsWith('//')` +
 *      `!safePath.includes('\\')` — extra defence-in-depth on the value
 *      actually flowing to the sink.
 *   4. `encodeURI(safePath)` at the sink itself — `js/html-injection`'s
 *      default model only recognises specific through-function sanitisers
 *      (`encodeURI`, `encodeURIComponent`, `DOMPurify.sanitize`, …) and
 *      does NOT propagate startsWith/equality barriers from `target` or
 *      `parsed.*` through the URL-property derivation into the assigned
 *      string. Because `encodeURI` escapes `%` itself (it is NOT
 *      idempotent on percent-encoded input), each sink restores the
 *      `%XX` escape sequences afterwards via DOUBLE_ENCODED_ESCAPE_RE.
 *      Characters the WHATWG serialiser emits raw but encodeURI escapes
 *      (`|^[]{}` and backtick) stay single-encoded — semantically
 *      equivalent, not byte-identical (see DOUBLE_ENCODED_ESCAPE_RE).
 *
 * External-URL paths get their own block with `URL.protocol` literal-
 * equality + userinfo guards on the URL-constructor's normalised `href`.
 *
 * @internal
 */
export function navigateTo(
  url: string,
  options?: { newWindow?: boolean; assign?: boolean },
): void {
  const target = ensureAppRoot(url);
  // Router-relative fast-path: triple-layer barrier so every CodeQL query
  // family that fires on `window.location.*` / `window.history.*` sees a
  // recognised sanitiser:
  //   1. Outer `startsWith('/')` + `!startsWith('//')` + `!includes('\\')`
  //      on `target` — recognised by `js/client-side-unvalidated-url-
  //      redirection` and rules out protocol-relative + backslash-laden
  //      authority-spoofing.
  //   2. URL-constructor parse + literal-equality on `parsed.origin` and
  //      `parsed.protocol` — recognised by `js/xss-through-dom`. The
  //      constant base (`http://navigation-utils.invalid/`) keeps the parse
  //      deterministic under test mocks.
  //   3. Inline `startsWith('/')` + `!startsWith('//')` + `!includes('\\')`
  //      on `safePath` — the value actually fed to the sink. Required for
  //      `js/html-injection`, whose default model does NOT propagate
  //      sanitisers from `target` through the URL-property derivation
  //      (`parsed.pathname` etc.) into the assigned string.
  if (
    target.startsWith('/') &&
    !target.startsWith('//') &&
    !target.includes('\\')
  ) {
    let parsed: URL | null;
    try {
      parsed = new URL(target, SAFE_PATH_PARSE_BASE);
    } catch {
      parsed = null;
    }
    if (
      parsed !== null &&
      parsed.origin === SAFE_PATH_PARSE_ORIGIN &&
      parsed.protocol === 'http:'
    ) {
      const safePath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      if (
        safePath.startsWith('/') &&
        !safePath.startsWith('//') &&
        !safePath.includes('\\')
      ) {
        // `encodeURI` is CodeQL's built-in sanitiser for `js/html-injection`
        // on `window.location.*` sinks. The previous startsWith barriers
        // satisfy `js/url-redirection` and `js/xss-through-dom`, but
        // `js/html-injection`'s default model only recognises specific
        // through-function sanitisers (`encodeURI`, `encodeURIComponent`,
        // `DOMPurify.sanitize`, …). `encodeURI` escapes `%` itself, which
        // would double-encode the constructor-normalised path, so the
        // follow-up replace restores the `%XX` escape sequences (see
        // DOUBLE_ENCODED_ESCAPE_RE) — net effect: a runtime no-op for
        // legitimate paths with the sanitiser still visible at the sink.
        const sinkValue = encodeURI(safePath).replace(
          DOUBLE_ENCODED_ESCAPE_RE,
          '%$1',
        );
        if (options?.newWindow) {
          window.open(sinkValue, '_blank', NEW_TAB_FEATURES);
        } else if (options?.assign) {
          if (!shouldSkipDuplicateAssign(sinkValue)) {
            window.location.assign(sinkValue);
          }
        } else {
          window.location.href = sinkValue;
        }
        return;
      }
    }
  }
  // External-URL path: parse the input, verify the scheme is in our
  // allowlist via literal equality (CodeQL recognises constant-equality
  // barriers on `URL.protocol`), verify no userinfo, then feed the URL
  // constructor's normalised `href` to the sink. `parsed.href` is a fresh
  // string derived from the verified URL properties, so the data-flow
  // chain from `url` (source) to the sink is broken by the parse +
  // property-check pair.
  // `SAFE_NAVIGATION_URL_RE` requires an explicit `//` after http(s)/ftp,
  // mirroring `assertSafeNavigationUrl`. Without it, `new URL('http:evil.com')`
  // parses the authority as `evil.com` — a cross-origin URL masquerading as a
  // safe absolute one. The protocol-equality check below alone would accept it
  // because `parsed.protocol` is still `http:` after normalisation.
  let parsed: URL | null;
  try {
    parsed = new URL(target);
  } catch {
    parsed = null;
  }
  if (
    parsed !== null &&
    SAFE_NAVIGATION_URL_RE.test(target) &&
    (parsed.protocol === 'https:' ||
      parsed.protocol === 'http:' ||
      parsed.protocol === 'ftp:' ||
      parsed.protocol === 'mailto:' ||
      parsed.protocol === 'tel:') &&
    !parsed.username &&
    !parsed.password
  ) {
    const safeExternal = parsed.href;
    if (options?.newWindow) {
      window.open(safeExternal, '_blank', NEW_TAB_FEATURES);
    } else if (options?.assign) {
      if (!shouldSkipDuplicateAssign(safeExternal)) {
        window.location.assign(safeExternal);
      }
    } else {
      window.location.href = safeExternal;
    }
    return;
  }
  // eslint-disable-next-line no-console -- guarded surface, observable in dev.
  console.error('navigationUtils.navigateTo refused unsafe URL:', url);
  // Fallback to deployment home. Same triple-layer barrier so CodeQL sees
  // the sanitiser at this sink too (see `navigateTo` docstring).
  const home = ensureAppRoot('/');
  if (home.startsWith('/') && !home.startsWith('//') && !home.includes('\\')) {
    let homeUrl: URL | null;
    try {
      homeUrl = new URL(home, SAFE_PATH_PARSE_BASE);
    } catch {
      homeUrl = null;
    }
    if (
      homeUrl !== null &&
      homeUrl.origin === SAFE_PATH_PARSE_ORIGIN &&
      homeUrl.protocol === 'http:'
    ) {
      const safeHome = `${homeUrl.pathname}${homeUrl.search}${homeUrl.hash}`;
      if (
        safeHome.startsWith('/') &&
        !safeHome.startsWith('//') &&
        !safeHome.includes('\\')
      ) {
        // See router-relative branch above for `encodeURI` rationale.
        window.location.href = encodeURI(safeHome).replace(
          DOUBLE_ENCODED_ESCAPE_RE,
          '%$1',
        );
      }
    }
  }
}

/**
 * Imperative history-API navigation (no page load). Unsafe URLs become a
 * silent no-op + `console.error`; we deliberately do NOT fall back to a
 * full-page nav here because callers (e.g. dashboard-properties save)
 * already display their own success/failure feedback and a surprise
 * `window.location.href = '/'` would discard unsaved state.
 *
 * Inline barriers mirror `navigateTo` (see its docstring) so CodeQL
 * recognises the sanitiser at every `window.history.*` sink.
 *
 * @internal
 */
export function navigateWithState(
  url: string,
  state: Record<string, unknown>,
  options?: { replace?: boolean },
): void {
  const target = ensureAppRoot(url);
  // Router-relative fast-path (see `navigateTo` for full rationale on the
  // triple-layer barrier: outer `startsWith` triple on `target`, URL-
  // constructor parse with literal origin/protocol equality, and inline
  // `startsWith` triple on `safePath` itself for `js/html-injection`).
  if (
    target.startsWith('/') &&
    !target.startsWith('//') &&
    !target.includes('\\')
  ) {
    let parsed: URL | null;
    try {
      parsed = new URL(target, SAFE_PATH_PARSE_BASE);
    } catch {
      parsed = null;
    }
    if (
      parsed !== null &&
      parsed.origin === SAFE_PATH_PARSE_ORIGIN &&
      parsed.protocol === 'http:'
    ) {
      const safePath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      if (
        safePath.startsWith('/') &&
        !safePath.startsWith('//') &&
        !safePath.includes('\\')
      ) {
        // See `navigateTo` for `encodeURI` rationale.
        const sinkValue = encodeURI(safePath).replace(
          DOUBLE_ENCODED_ESCAPE_RE,
          '%$1',
        );
        if (options?.replace) {
          window.history.replaceState(state, '', sinkValue);
        } else {
          window.history.pushState(state, '', sinkValue);
        }
        return;
      }
    }
  }
  // External-URL path (see `navigateTo` for rationale, including the
  // `SAFE_NAVIGATION_URL_RE` `//`-after-scheme requirement that rejects
  // `http:evil.com`-style scheme-without-authority bypasses).
  let parsed: URL | null;
  try {
    parsed = new URL(target);
  } catch {
    parsed = null;
  }
  if (
    parsed !== null &&
    SAFE_NAVIGATION_URL_RE.test(target) &&
    (parsed.protocol === 'https:' ||
      parsed.protocol === 'http:' ||
      parsed.protocol === 'ftp:' ||
      parsed.protocol === 'mailto:' ||
      parsed.protocol === 'tel:') &&
    !parsed.username &&
    !parsed.password
  ) {
    const safeExternal = parsed.href;
    if (options?.replace) {
      window.history.replaceState(state, '', safeExternal);
    } else {
      window.history.pushState(state, '', safeExternal);
    }
    return;
  }
  // eslint-disable-next-line no-console -- guarded surface, observable in dev.
  console.error('navigationUtils.navigateWithState refused unsafe URL:', url);
}

/** Open a router-relative path in a new browser tab. */
export function openInNewTab(path: string): void {
  window.open(
    assertSafeNavigationUrl(ensureAppRoot(path)),
    '_blank',
    NEW_TAB_FEATURES,
  );
}

/**
 * Full-page redirect to a router-relative path. Use only when the destination
 * is outside the React Router tree or a hard reload is required.
 *
 * Failure mode differs from the throwing helpers (`openInNewTab`,
 * `getShareableUrl`, `AppLink`): this delegates to `navigateTo`, which on an
 * unsafe URL does NOT throw — it soft-falls back to `ensureAppRoot('/')` and
 * logs via `console.error`. Prefer a throwing helper when the caller must
 * observe a rejected navigation.
 */
export function redirect(path: string): void {
  navigateTo(path);
}

/** Build a `${origin}${appRoot}${path}` URL for clipboard / share targets. */
export function getShareableUrl(path: string): string {
  const safePath = assertSafeNavigationUrl(ensureAppRoot(path));
  return `${window.location.origin}${safePath}`;
}

/**
 * Anchor element that prefixes its href with the application root. Use
 * instead of `<a href={varExpr}>` whenever the href is computed at runtime.
 */
export function AppLink(
  props: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string },
): ReactElement {
  const { href, ...rest } = props;
  return createElement('a', {
    ...rest,
    href: assertSafeNavigationUrl(ensureAppRoot(href)),
  });
}

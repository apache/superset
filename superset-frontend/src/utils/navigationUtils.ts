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

// Allow-list of safe URL shapes for navigation: router-relative paths and a
// small set of known-safe schemes. `ensureAppRoot` already neutralises
// `javascript:` / `data:` by prefixing them as relative paths; protocol-
// relative `//host` is intentionally excluded here because it is a cross-
// origin navigation primitive that previously enabled open redirects.
//
// nit-3 / AF-1 hardening: the leading-slash branch also rejects any URL
// containing a backslash anywhere — browsers normalise `/\evil.com` →
// `//evil.com` in the special-scheme authority, so backslashes in any
// position let an attacker craft a path that looks router-relative until
// the browser parses it. http(s)/ftp URLs with userinfo (`@` before the
// first `/` after `//`) are rejected by the post-regex authority check
// below, since `https://good@evil.com` resolves to the host `evil.com`
// despite presenting as a same-origin-looking URL to the eye.
const SAFE_NAVIGATION_URL_RE = /^(?:\/(?!\/)|https?:|ftp:|mailto:|tel:)/i;
const USERINFO_BEARING_SCHEME_RE = /^(?:https?|ftp):/i;

function assertSafeNavigationUrl(url: string): string {
  if (!SAFE_NAVIGATION_URL_RE.test(url) || url.includes('\\')) {
    throw new Error(
      'navigationUtils refused unsafe URL: only relative paths and ' +
        'http(s):, ftp:, mailto:, tel: schemes are allowed.',
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
 * @internal
 */
export function navigateTo(
  url: string,
  options?: { newWindow?: boolean; assign?: boolean },
): void {
  let safe: string;
  try {
    safe = assertSafeNavigationUrl(ensureAppRoot(url));
  } catch (err) {
    // Full-page nav fallback: the user clicked something that resolved to
    // the home page is better than landing on an attacker-controlled origin.
    // eslint-disable-next-line no-console -- guarded surface, observable in dev.
    console.error('navigationUtils.navigateTo refused unsafe URL:', url, err);
    window.location.href = ensureAppRoot('/');
    return;
  }
  if (options?.newWindow) {
    window.open(safe, '_blank', 'noopener noreferrer');
  } else if (options?.assign) {
    window.location.assign(safe);
  } else {
    window.location.href = safe;
  }
}

/**
 * Imperative history-API navigation (no page load). Unsafe URLs become a
 * silent no-op + `console.error`; we deliberately do NOT fall back to a
 * full-page nav here because callers (e.g. dashboard-properties save)
 * already display their own success/failure feedback and a surprise
 * `window.location.href = '/'` would discard unsaved state.
 *
 * @internal
 */
export function navigateWithState(
  url: string,
  state: Record<string, unknown>,
  options?: { replace?: boolean },
): void {
  let safe: string;
  try {
    safe = assertSafeNavigationUrl(ensureAppRoot(url));
  } catch (err) {
    // eslint-disable-next-line no-console -- guarded surface, observable in dev.
    console.error(
      'navigationUtils.navigateWithState refused unsafe URL:',
      url,
      err,
    );
    return;
  }
  if (options?.replace) {
    window.history.replaceState(state, '', safe);
  } else {
    window.history.pushState(state, '', safe);
  }
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

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

// The existing navigationUtils tests pin `javascript:`-scheme neutralisation
// (`navigationUtils.directDom.test.tsx:203-219`), but the broader
// script/data/binary-content scheme family — `data:`, `vbscript:`, `file:`,
// `blob:`, `chrome:` — was never explicitly pinned. The contract is the
// same for every dangerous scheme: `ensureAppRoot` prefixes the URL, the
// prefixed result starts with `/<appRoot>/` so the SAFE_NAVIGATION_URL_RE
// leading-slash branch matches, and the actual browser navigation lands on
// `/<appRoot>/<scheme:body>` — a 404'd path segment, NEVER an executable
// scheme. The test pins each scheme so a future allow-list refactor can't
// silently re-enable any of them.
//
// Backend cover for the same threat sits in
// `superset/views/redirect.py` (DANGEROUS_SCHEMES frozenset) — verified by
// `tests/unit_tests/views/test_redirect_view_subdirectory.py::
// test_dangerous_schemes_blocked_under_subdir`. The two layers together
// give defence-in-depth for the alert/report email-click path and the
// in-app navigation path.

import { withApplicationRoot } from 'spec/helpers/withApplicationRoot';

jest.setTimeout(20000);

// Each scheme is constructed piecewise to avoid oxlint's `no-script-url`
// flagging the literal — same pattern the directDom test uses. Each entry:
//   - label: human-readable scheme name
//   - build(): returns the raw URL string; piecewise to dodge linters
const DANGEROUS_SCHEMES: ReadonlyArray<{ label: string; build: () => string }> =
  [
    { label: 'data:', build: () => `${'data:'}text/html,<script>1</script>` },
    { label: 'vbscript:', build: () => `${'vbscript:'}msgbox(1)` },
    { label: 'file:', build: () => `${'file:'}///etc/passwd` },
    { label: 'blob:', build: () => `${'blob:'}https://evil.example.com/abc` },
    { label: 'chrome:', build: () => `${'chrome:'}//settings` },
    { label: 'about:', build: () => `${'about:'}blank` },
    // Uppercase scheme — case-insensitivity is a known bypass class for
    // origin/scheme allow-lists. Pin that the prefix path is taken
    // regardless of case (the SAFE_NAVIGATION_URL_RE is case-insensitive
    // for the http/ftp branches; data: / vbscript: must fall through to
    // the leading-slash branch via ensureAppRoot).
    { label: 'DATA:', build: () => `${'DATA:'}text/html,<script>1</script>` },
    { label: 'VBScript:', build: () => `${'VBScript:'}msgbox(1)` },
  ];

describe('openInNewTab neutralises dangerous schemes by appRoot prefix', () => {
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  test.each(DANGEROUS_SCHEMES)(
    'subdir deploy: $label is neutralised into a prefixed path segment',
    async ({ build }: { label: string; build: () => string }) => {
      const scheme = build();
      await withApplicationRoot('/superset/', async () => {
        const { openInNewTab } = await import('src/utils/navigationUtils');
        openInNewTab(scheme);
        expect(openSpy).toHaveBeenCalledTimes(1);
        const [calledUrl] = openSpy.mock.calls[0];
        // Contract: window.open receives `<appRoot>/<scheme:body>` — a 404'd
        // path segment, never the original scheme.
        expect(calledUrl).toBe(`/superset/${scheme}`);
        // Defence-in-depth: the call MUST NOT start with any executable
        // scheme. A future refactor that swaps `ensureAppRoot` for a
        // scheme-aware passthrough would surface here.
        expect(calledUrl).not.toMatch(
          /^(?:data|vbscript|file|blob|chrome|about|javascript):/i,
        );
      });
    },
  );

  test.each(DANGEROUS_SCHEMES)(
    'root deploy: $label is neutralised into a prefixed path segment',
    async ({ build }: { label: string; build: () => string }) => {
      const scheme = build();
      await withApplicationRoot('', async () => {
        const { openInNewTab } = await import('src/utils/navigationUtils');
        openInNewTab(scheme);
        expect(openSpy).toHaveBeenCalledTimes(1);
        const [calledUrl] = openSpy.mock.calls[0];
        // With empty appRoot, ensureAppRoot is NOT a no-op for a dangerous
        // scheme: a `data:...` string is not safe-absolute, so it gets a
        // leading slash and becomes `/data:...`. SAFE_NAVIGATION_URL_RE then
        // accepts it via the leading-slash branch, so `window.open` IS
        // invoked — but with an inert same-origin path (`/data:...`, a 404),
        // never an executable scheme. The neutralisation is the path prefix,
        // not a throw; this is why the assertion is `openSpy` called with
        // `/${scheme}` rather than `expect().toThrow`.
        expect(calledUrl).toBe(`/${scheme}`);
        expect(calledUrl).not.toMatch(
          /^(?:data|vbscript|file|blob|chrome|about|javascript):/i,
        );
      });
    },
  );
});

// `redirect` follows the same neutralisation path as `openInNewTab` but
// goes through `navigateTo`, which catches the assertSafeNavigationUrl
// throw and falls back to `ensureAppRoot('/')`. Since the schemes above
// are neutralised by ensureAppRoot rather than throwing, the redirect
// lands on the prefixed-path-segment — same as window.open above.
describe('redirect neutralises dangerous schemes by appRoot prefix', () => {
  let originalLocation: Location;
  let hrefValue: { value: string };

  beforeEach(() => {
    originalLocation = window.location;
    hrefValue = { value: '' };
    delete (window as unknown as { location?: Location }).location;
    (window as unknown as { location: Location }).location = {
      get href() {
        return hrefValue.value;
      },
      set href(next: string) {
        hrefValue.value = next;
      },
      assign(next: string) {
        hrefValue.value = next;
      },
    } as Location;
  });

  afterEach(() => {
    (window as unknown as { location: Location }).location = originalLocation;
  });

  test.each(DANGEROUS_SCHEMES)(
    'redirect prefixes $label without executing the scheme',
    async ({ build }: { label: string; build: () => string }) => {
      const scheme = build();
      await withApplicationRoot('/superset/', async () => {
        const { redirect } = await import('src/utils/navigationUtils');
        redirect(scheme);
        // The browser would resolve the prefixed path as `<origin>/superset/<scheme:body>`
        // — a 404 against the static handler, never an executable navigation.
        //
        // `navigateTo` runs the path through `new URL(target, BASE).pathname`
        // then `encodeURI()` as part of the triple-layer CodeQL sanitiser
        // (`navigationUtils.ts:197-235`). Special chars in the scheme body
        // are URL-encoded (`<` → `%3C`, then `%` → `%25` on the second
        // pass), producing a fully inert path. encodeURI is *additional*
        // neutralisation on top of the scheme-survives-as-path-segment
        // shape — the open-redirect contract is satisfied by either, but
        // asserting byte-identity (the prior shape) was wrong because it
        // predated the encodeURI hardening.
        const schemePrefix = `${scheme.split(':')[0]}:`;
        expect(hrefValue.value.startsWith(`/superset/${schemePrefix}`)).toBe(
          true,
        );
        expect(hrefValue.value).not.toMatch(
          /^(?:data|vbscript|file|blob|chrome|about|javascript):/i,
        );
      });
    },
  );
});

// getShareableUrl is the clipboard / "Copy link" path. It must also
// neutralise — pasting a `data:` link into someone else's chat is the same
// open-redirect class once the recipient clicks. Pinning here mirrors the
// directDom test which only covers the imperative-nav helpers.
describe('getShareableUrl neutralises dangerous schemes', () => {
  test.each(DANGEROUS_SCHEMES)(
    'subdir deploy: shareable URL for $label is a prefixed path on this origin',
    async ({ build }: { label: string; build: () => string }) => {
      const scheme = build();
      await withApplicationRoot('/superset/', async () => {
        const { getShareableUrl } = await import('src/utils/navigationUtils');
        const url = getShareableUrl(scheme);
        // Pasted-link recipients land on this origin — not on the
        // attacker-supplied scheme. getShareableUrl returns the raw
        // `${origin}${ensureAppRoot(path)}` concatenation, so the shape
        // is `${origin}/superset/<scheme:body>` byte-for-byte — no URL
        // parser-driven re-encoding involved.
        expect(url).toBe(`${window.location.origin}/superset/${scheme}`);
        expect(url).not.toMatch(
          /^(?:data|vbscript|file|blob|chrome|about|javascript):/i,
        );
      });
    },
  );
});

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
import { withApplicationRoot } from 'spec/helpers/withApplicationRoot';

// Surface any future hang as a Jest timeout instead of stalling CI.
jest.setTimeout(20000);

describe('openInNewTab', () => {
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  test('passes router-relative path through unchanged when application root is empty', async () => {
    await withApplicationRoot('', async () => {
      const { openInNewTab } = await import('src/utils/navigationUtils');
      openInNewTab('/sqllab?new=true');
      expect(openSpy).toHaveBeenCalledWith(
        '/sqllab?new=true',
        '_blank',
        'noopener noreferrer',
      );
    });
  });

  test('prefixes router-relative path with application root under subdirectory deployment', async () => {
    await withApplicationRoot('/superset/', async () => {
      const { openInNewTab } = await import('src/utils/navigationUtils');
      openInNewTab('/sqllab?new=true');
      expect(openSpy).toHaveBeenCalledWith(
        '/superset/sqllab?new=true',
        '_blank',
        'noopener noreferrer',
      );
    });
  });

  test('prefixes correctly for nested subdirectory roots', async () => {
    await withApplicationRoot('/a/b/c/', async () => {
      const { openInNewTab } = await import('src/utils/navigationUtils');
      openInNewTab('/dashboard/list');
      expect(openSpy).toHaveBeenCalledWith(
        '/a/b/c/dashboard/list',
        '_blank',
        'noopener noreferrer',
      );
    });
  });

  test('passes absolute URLs through unchanged regardless of application root', async () => {
    await withApplicationRoot('/superset/', async () => {
      const { openInNewTab } = await import('src/utils/navigationUtils');
      openInNewTab('https://external.example.com/docs');
      expect(openSpy).toHaveBeenCalledWith(
        'https://external.example.com/docs',
        '_blank',
        'noopener noreferrer',
      );
    });
  });

  test('passes mailto: URLs through unchanged', async () => {
    await withApplicationRoot('/superset/', async () => {
      const { openInNewTab } = await import('src/utils/navigationUtils');
      openInNewTab('mailto:owner@example.com');
      expect(openSpy).toHaveBeenCalledWith(
        'mailto:owner@example.com',
        '_blank',
        'noopener noreferrer',
      );
    });
  });

  test('uses noopener noreferrer for security on every call', async () => {
    await withApplicationRoot('/superset/', async () => {
      const { openInNewTab } = await import('src/utils/navigationUtils');
      openInNewTab('/sqllab');
      expect(openSpy).toHaveBeenCalledTimes(1);
      const features = openSpy.mock.calls[0][2] as string;
      expect(features).toContain('noopener');
      expect(features).toContain('noreferrer');
    });
  });

  test('refuses protocol-relative URLs to block open-redirect via `//evil.com`', async () => {
    await withApplicationRoot('/superset/', async () => {
      const { openInNewTab } = await import('src/utils/navigationUtils');
      expect(() => openInNewTab('//evil.example.com/phish')).toThrow(
        /refused unsafe URL/,
      );
      expect(openSpy).not.toHaveBeenCalled();
    });
  });

  // Scheme-without-authority bypass. WHATWG
  // URL parsers extract the host from `http:evil.com/foo` as `evil.com`,
  // so the previous regex `/^https?:/i` mistook a cross-origin URL for a
  // safe absolute one. The tightened regex requires `//` after the scheme.
  test.each([
    ['http:evil.example.com/phish'],
    ['https:evil.example.com/phish'],
    ['HTTP:evil.example.com/phish'],
    ['ftp:evil.example.com/file'],
  ])('refuses scheme-without-authority URL %s', async (unsafeUrl: string) => {
    await withApplicationRoot('/superset/', async () => {
      const { openInNewTab } = await import('src/utils/navigationUtils');
      expect(() => openInNewTab(unsafeUrl)).toThrow(/refused unsafe URL/);
      expect(openSpy).not.toHaveBeenCalled();
    });
  });

  // C0/C1 controls and zero-width / bidi
  // formatting marks are stripped by browsers before URL parsing, so a
  // string like `\t//evil.com` would survive the leading-slash check and
  // navigate cross-origin. Reject them outright.
  test.each([
    ['\t//evil.example.com'],
    ['\n//evil.example.com'],
    ['\r//evil.example.com'],
    ['‎/foo'],
    ['​/foo'],
    ['﻿/foo'],
  ])(
    'refuses URL %j containing control or zero-width chars',
    async (unsafeUrl: string) => {
      await withApplicationRoot('/superset/', async () => {
        const { openInNewTab } = await import('src/utils/navigationUtils');
        expect(() => openInNewTab(unsafeUrl)).toThrow(/refused unsafe URL/);
        expect(openSpy).not.toHaveBeenCalled();
      });
    },
  );

  // The bidi formatting
  // ranges U+202A..U+202E (LRE/RLE/PDF/LRO/RLO) and U+2066..U+2069
  // (LRI/RLI/FSI/PDI) were promised by the earlier comment but missing from
  // the original regex. Pin them directly so a documentation/regex drift
  // can't reintroduce the gap.
  test.each([
    ['‪/foo', 'U+202A LRE'],
    ['‫/foo', 'U+202B RLE'],
    ['‬/foo', 'U+202C PDF'],
    ['‭/foo', 'U+202D LRO'],
    ['‮/foo', 'U+202E RLO'],
    ['⁦/foo', 'U+2066 LRI'],
    ['⁧/foo', 'U+2067 RLI'],
    ['⁨/foo', 'U+2068 FSI'],
    ['⁩/foo', 'U+2069 PDI'],
  ])(
    'refuses URL containing %s bidi formatting mark',
    async (unsafeUrl: string, _label: string) => {
      await withApplicationRoot('/superset/', async () => {
        const { openInNewTab } = await import('src/utils/navigationUtils');
        expect(() => openInNewTab(unsafeUrl)).toThrow(/refused unsafe URL/);
        expect(openSpy).not.toHaveBeenCalled();
      });
    },
  );
});

describe('redirect', () => {
  let originalLocation: Location;

  beforeEach(() => {
    originalLocation = window.location;
    delete (window as unknown as { location?: Location }).location;
    (window as unknown as { location: { href: string } }).location = {
      href: '',
    } as Location;
  });

  afterEach(() => {
    (window as unknown as { location: Location }).location = originalLocation;
  });

  test('sets window.location.href to the unprefixed path under empty root', async () => {
    await withApplicationRoot('', async () => {
      const { redirect } = await import('src/utils/navigationUtils');
      redirect('/');
      expect(window.location.href).toBe('/');
    });
  });

  test('prefixes the path under a subdirectory deployment', async () => {
    await withApplicationRoot('/superset/', async () => {
      const { redirect } = await import('src/utils/navigationUtils');
      redirect('/');
      expect(window.location.href).toBe('/superset/');
    });
  });

  test('passes absolute URLs through unchanged', async () => {
    await withApplicationRoot('/superset/', async () => {
      const { redirect } = await import('src/utils/navigationUtils');
      redirect('https://external.example.com/foo');
      expect(window.location.href).toBe('https://external.example.com/foo');
    });
  });

  // encodeURI-at-the-sink regression: see the
  // matching navigateWithState tests — `%27`/`%20` must survive un-doubled.
  test('does not double-encode percent-encoded query strings', async () => {
    await withApplicationRoot('/superset/', async () => {
      const { redirect } = await import('src/utils/navigationUtils');
      redirect('/dashboard/list/?filters=(label:%27a%20b%27)');
      expect(window.location.href).toBe(
        '/superset/dashboard/list/?filters=(label:%27a%20b%27)',
      );
    });
  });

  // Backslash-laden URLs
  // were accepted by `SAFE_NAVIGATION_URL_RE` and the sibling guards in
  // `ensureAppRoot` / `isAllowedScheme`. Browsers normalise `/\` → `//` in
  // the special-scheme authority, so `/\evil.com` became a cross-origin
  // navigation. The hardened guard must reject these *before* nav, and
  // `redirect` (which routes through `navigateTo`) must fall back to `/`
  // with a `console.error` rather than navigating to the unsafe target.

  test.each([
    ['empty app root', ''],
    ['/superset app root', '/superset/'],
  ])(
    'falls back to "/" + console.error for /\\evil.com under %s',
    async (_label, appRoot) => {
      await withApplicationRoot(appRoot, async () => {
        const errorSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        try {
          const { redirect } = await import('src/utils/navigationUtils');
          redirect('/\\evil.com');
          // Fall back to ensureAppRoot('/') under the active root.
          expect(window.location.href).toBe(
            appRoot === '' ? '/' : '/superset/',
          );
          expect(errorSpy).toHaveBeenCalled();
        } finally {
          errorSpy.mockRestore();
        }
      });
    },
  );

  test('falls back to "/" + console.error for https://good@evil.com (userinfo)', async () => {
    await withApplicationRoot('', async () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      try {
        const { redirect } = await import('src/utils/navigationUtils');
        redirect('https://good@evil.example.com/path');
        expect(window.location.href).toBe('/');
        expect(errorSpy).toHaveBeenCalled();
      } finally {
        errorSpy.mockRestore();
      }
    });
  });

  test('falls back to "/" + console.error for //evil.com (already-blocked regression)', async () => {
    await withApplicationRoot('', async () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      try {
        const { redirect } = await import('src/utils/navigationUtils');
        redirect('//evil.example.com');
        expect(window.location.href).toBe('/');
        expect(errorSpy).toHaveBeenCalled();
      } finally {
        errorSpy.mockRestore();
      }
    });
  });

  // Scheme-without-authority bypass on the full-page-nav path. WHATWG URL
  // parsers extract the host from `http:evil.com/foo` as `evil.com`, so the
  // external-URL branch's bare `parsed.protocol === 'http:'` check mistook a
  // cross-origin URL for a safe absolute one. `openInNewTab` already rejected
  // this shape; `redirect` (→ `navigateTo`) must too, falling back to `/`
  // with a `console.error` rather than following the cross-origin target.
  test.each([
    ['http:evil.example.com/phish'],
    ['https:evil.example.com/phish'],
    ['HTTP:evil.example.com/phish'],
    ['ftp:evil.example.com/file'],
  ])(
    'falls back to "/" + console.error for scheme-without-authority URL %s',
    async (unsafeUrl: string) => {
      await withApplicationRoot('', async () => {
        const errorSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        try {
          const { redirect } = await import('src/utils/navigationUtils');
          redirect(unsafeUrl);
          expect(window.location.href).toBe('/');
          expect(errorSpy).toHaveBeenCalled();
        } finally {
          errorSpy.mockRestore();
        }
      });
    },
  );
});

// `navigateTo` and `navigateWithState` are exported imperative helpers
// and are the entry points that these tests cover.
describe('navigateTo', () => {
  let originalLocation: Location;
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    originalLocation = window.location;
    delete (window as unknown as { location?: Location }).location;
    (
      window as unknown as {
        location: { href: string; assign: jest.Mock };
      }
    ).location = {
      href: '',
      assign: jest.fn(),
    };
    openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    (window as unknown as { location: Location }).location = originalLocation;
    openSpy.mockRestore();
  });

  test('falls back to "/" + console.error for /\\evil.com (default href)', async () => {
    await withApplicationRoot('', async () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      try {
        const { navigateTo } = await import('src/utils/navigationUtils');
        navigateTo('/\\evil.com');
        expect(window.location.href).toBe('/');
        expect(errorSpy).toHaveBeenCalled();
      } finally {
        errorSpy.mockRestore();
      }
    });
  });

  test('falls back to "/" + console.error for /\\evil.com (newWindow path)', async () => {
    await withApplicationRoot('', async () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      try {
        const { navigateTo } = await import('src/utils/navigationUtils');
        navigateTo('/\\evil.com', { newWindow: true });
        // window.open never called with the unsafe URL; fallback to href='/'
        expect(openSpy).not.toHaveBeenCalledWith(
          expect.stringContaining('\\evil.com'),
          expect.anything(),
          expect.anything(),
        );
        expect(window.location.href).toBe('/');
        expect(errorSpy).toHaveBeenCalled();
      } finally {
        errorSpy.mockRestore();
      }
    });
  });

  // Scheme-without-authority bypass: `new URL('http:evil.com/foo')` resolves
  // the host to `evil.com`, so the external-URL branch must require an
  // explicit `//` after the scheme (mirroring `SAFE_NAVIGATION_URL_RE`) and
  // fall back to `/` rather than navigating cross-origin.
  test.each([
    ['http:evil.example.com/phish'],
    ['https:evil.example.com/phish'],
    ['HTTP:evil.example.com/phish'],
    ['ftp:evil.example.com/file'],
  ])(
    'falls back to "/" + console.error for scheme-without-authority URL %s',
    async (unsafeUrl: string) => {
      await withApplicationRoot('', async () => {
        const errorSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        try {
          const { navigateTo } = await import('src/utils/navigationUtils');
          navigateTo(unsafeUrl);
          expect(window.location.href).toBe('/');
          expect(openSpy).not.toHaveBeenCalled();
          expect(errorSpy).toHaveBeenCalled();
        } finally {
          errorSpy.mockRestore();
        }
      });
    },
  );

  test('refuses scheme-without-authority URL on the newWindow path', async () => {
    await withApplicationRoot('', async () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      try {
        const { navigateTo } = await import('src/utils/navigationUtils');
        navigateTo('http:evil.example.com/phish', { newWindow: true });
        expect(openSpy).not.toHaveBeenCalled();
        expect(window.location.href).toBe('/');
        expect(errorSpy).toHaveBeenCalled();
      } finally {
        errorSpy.mockRestore();
      }
    });
  });

  test('passes legitimate router-relative path through unchanged', async () => {
    await withApplicationRoot('/superset/', async () => {
      const { navigateTo } = await import('src/utils/navigationUtils');
      navigateTo('/dashboard/list/');
      expect(window.location.href).toBe('/superset/dashboard/list/');
    });
  });

  test('uses window.location.assign (not href) for a router-relative path when { assign: true }', async () => {
    await withApplicationRoot('/superset/', async () => {
      const { navigateTo } = await import('src/utils/navigationUtils');
      navigateTo('/dashboard/list/', { assign: true });
      expect(window.location.assign).toHaveBeenCalledWith(
        '/superset/dashboard/list/',
      );
      // The assign branch must not also fall through to the href sink.
      expect(window.location.href).toBe('');
    });
  });

  test('uses window.location.assign for an external URL when { assign: true }', async () => {
    await withApplicationRoot('/superset/', async () => {
      const { navigateTo } = await import('src/utils/navigationUtils');
      navigateTo('https://external.example.com/docs', { assign: true });
      expect(window.location.assign).toHaveBeenCalledWith(
        'https://external.example.com/docs',
      );
      expect(window.location.href).toBe('');
    });
  });
});

describe('navigateWithState', () => {
  let pushSpy: jest.SpyInstance;
  let replaceSpy: jest.SpyInstance;

  beforeEach(() => {
    pushSpy = jest
      .spyOn(window.history, 'pushState')
      .mockImplementation(() => {});
    replaceSpy = jest
      .spyOn(window.history, 'replaceState')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    pushSpy.mockRestore();
    replaceSpy.mockRestore();
  });

  test('no-ops + console.error for /\\evil.com (does NOT trigger full-page nav)', async () => {
    await withApplicationRoot('', async () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      try {
        const { navigateWithState } = await import('src/utils/navigationUtils');
        navigateWithState('/\\evil.com', { from: 'test' });
        expect(pushSpy).not.toHaveBeenCalled();
        expect(replaceSpy).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalled();
      } finally {
        errorSpy.mockRestore();
      }
    });
  });

  // Scheme-without-authority bypass on the history-API path: the external-URL
  // branch must reject `http:evil.com/foo` (host normalises to `evil.com`)
  // and no-op rather than pushing a cross-origin URL into history.
  test.each([
    ['http:evil.example.com/phish'],
    ['https:evil.example.com/phish'],
    ['HTTP:evil.example.com/phish'],
    ['ftp:evil.example.com/file'],
  ])(
    'no-ops + console.error for scheme-without-authority URL %s',
    async (unsafeUrl: string) => {
      await withApplicationRoot('', async () => {
        const errorSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        try {
          const { navigateWithState } =
            await import('src/utils/navigationUtils');
          navigateWithState(unsafeUrl, { from: 'test' });
          expect(pushSpy).not.toHaveBeenCalled();
          expect(replaceSpy).not.toHaveBeenCalled();
          expect(errorSpy).toHaveBeenCalled();
        } finally {
          errorSpy.mockRestore();
        }
      });
    },
  );

  test('passes legitimate router-relative path through to pushState', async () => {
    await withApplicationRoot('/superset/', async () => {
      const { navigateWithState } = await import('src/utils/navigationUtils');
      navigateWithState('/dashboard/42/', { from: 'test' });
      expect(pushSpy).toHaveBeenCalledWith(
        { from: 'test' },
        '',
        '/superset/dashboard/42/',
      );
    });
  });

  test('uses replaceState (not pushState) when { replace: true }', async () => {
    await withApplicationRoot('/superset/', async () => {
      const { navigateWithState } = await import('src/utils/navigationUtils');
      navigateWithState('/dashboard/42/', { from: 'test' }, { replace: true });
      expect(replaceSpy).toHaveBeenCalledWith(
        { from: 'test' },
        '',
        '/superset/dashboard/42/',
      );
      expect(pushSpy).not.toHaveBeenCalled();
    });
  });

  // encodeURI-at-the-sink regression: the CodeQL
  // `js/html-injection` sanitiser escapes `%` itself, so already-percent-
  // encoded paths (the URL constructor's output always is) were double-
  // encoded — `%20` → `%2520` — corrupting the pushed URL.
  test('does not double-encode percent-encoded rison paths (pushState)', async () => {
    await withApplicationRoot('', async () => {
      const { navigateWithState } = await import('src/utils/navigationUtils');
      navigateWithState('/dashboard/list/?filters=(label:%27a%20b%27)', {});
      expect(pushSpy).toHaveBeenCalledWith(
        {},
        '',
        '/dashboard/list/?filters=(label:%27a%20b%27)',
      );
    });
  });

  test('single-encodes raw spaces and unicode path segments (pushState)', async () => {
    await withApplicationRoot('/superset/', async () => {
      const { navigateWithState } = await import('src/utils/navigationUtils');
      navigateWithState('/dashboard/百分比 slug/', {});
      expect(pushSpy).toHaveBeenCalledWith(
        {},
        '',
        '/superset/dashboard/%E7%99%BE%E5%88%86%E6%AF%94%20slug/',
      );
    });
  });

  // Restore-regex corner cases (review follow-up on the encodeURI fix):
  // pinned so a future "simplification" of DOUBLE_ENCODED_ESCAPE_RE (e.g.
  // an uppercase-only hex class, or a greedy restore that collapses
  // intentional `%25XX`) cannot pass the suite while corrupting URLs.
  test('preserves intentionally double-encoded %2520 (pushState)', async () => {
    await withApplicationRoot('', async () => {
      const { navigateWithState } = await import('src/utils/navigationUtils');
      navigateWithState('/dashboard/list/?q=%2520', {});
      expect(pushSpy).toHaveBeenCalledWith({}, '', '/dashboard/list/?q=%2520');
    });
  });

  test('preserves literal %25 followed by hex (%25AB) (pushState)', async () => {
    await withApplicationRoot('', async () => {
      const { navigateWithState } = await import('src/utils/navigationUtils');
      navigateWithState('/dashboard/list/?q=%25AB', {});
      expect(pushSpy).toHaveBeenCalledWith({}, '', '/dashboard/list/?q=%25AB');
    });
  });

  test('preserves lowercase hex escapes (%2f) (pushState)', async () => {
    await withApplicationRoot('', async () => {
      const { navigateWithState } = await import('src/utils/navigationUtils');
      navigateWithState('/dashboard/a%2fb/', {});
      expect(pushSpy).toHaveBeenCalledWith({}, '', '/dashboard/a%2fb/');
    });
  });

  test('single-encodes an invalid percent sequence (%zz) (pushState)', async () => {
    await withApplicationRoot('', async () => {
      const { navigateWithState } = await import('src/utils/navigationUtils');
      navigateWithState('/dashboard/100%zz/', {});
      expect(pushSpy).toHaveBeenCalledWith({}, '', '/dashboard/100%25zz/');
    });
  });
});

describe('getShareableUrl', () => {
  test('returns origin + unprefixed path under empty root', async () => {
    await withApplicationRoot('', async () => {
      const { getShareableUrl } = await import('src/utils/navigationUtils');
      expect(getShareableUrl('/sqllab?id=1')).toBe(
        `${window.location.origin}/sqllab?id=1`,
      );
    });
  });

  test('returns origin + prefixed path under subdirectory deployment', async () => {
    await withApplicationRoot('/superset/', async () => {
      const { getShareableUrl } = await import('src/utils/navigationUtils');
      expect(getShareableUrl('/sqllab?id=1')).toBe(
        `${window.location.origin}/superset/sqllab?id=1`,
      );
    });
  });

  // Composition pin:
  // `assertSafeNavigationUrl` is module-private; route the pin through the
  // purest public helper. `getShareableUrl` runs the same composition
  // (`assertSafeNavigationUrl(ensureAppRoot(...))`) as `openInNewTab` /
  // `AppLink`, side-effect-free. Throwing here proves the guard runs
  // post-`ensureAppRoot`, which is the invariant `pathUtils.ts:41` must
  // preserve in lockstep.
  test.each([
    ['empty app root', ''],
    ['/superset app root', '/superset/'],
  ])(
    'throws for /\\evil.com under %s (composition pin)',
    async (_label, appRoot) => {
      await withApplicationRoot(appRoot, async () => {
        const { getShareableUrl } = await import('src/utils/navigationUtils');
        expect(() => getShareableUrl('/\\evil.com')).toThrow(
          /refused unsafe URL/,
        );
      });
    },
  );

  test('throws for //evil.com (already-blocked regression)', async () => {
    await withApplicationRoot('', async () => {
      const { getShareableUrl } = await import('src/utils/navigationUtils');
      expect(() => getShareableUrl('//evil.example.com')).toThrow(
        /refused unsafe URL/,
      );
    });
  });

  test('throws for https://good@evil.com (userinfo)', async () => {
    await withApplicationRoot('', async () => {
      const { getShareableUrl } = await import('src/utils/navigationUtils');
      expect(() =>
        getShareableUrl('https://good@evil.example.com/path'),
      ).toThrow(/refused unsafe URL/);
    });
  });
});

describe('openInNewTab — sibling-site coverage', () => {
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  test.each([
    ['empty app root', ''],
    ['/superset app root', '/superset/'],
  ])(
    'throws for /\\evil.com under %s and never calls window.open',
    async (_label, appRoot) => {
      await withApplicationRoot(appRoot, async () => {
        const { openInNewTab } = await import('src/utils/navigationUtils');
        expect(() => openInNewTab('/\\evil.com')).toThrow(/refused unsafe URL/);
        expect(openSpy).not.toHaveBeenCalled();
      });
    },
  );

  test('throws for https://good@evil.com (userinfo)', async () => {
    await withApplicationRoot('', async () => {
      const { openInNewTab } = await import('src/utils/navigationUtils');
      expect(() => openInNewTab('https://good@evil.example.com')).toThrow(
        /refused unsafe URL/,
      );
      expect(openSpy).not.toHaveBeenCalled();
    });
  });
});

// AppLink renders a real React element, so its tests can't use
// withApplicationRoot — `jest.resetModules()` corrupts @testing-library/react
// when its dist files are re-imported across the reset. Mock applicationRoot
// at module scope and vary it per test instead.
//
// Note: the mock factory is hoisted, so `mockApplicationRoot` must be
// `mock`-prefixed to satisfy Jest's out-of-scope-variable check.

// Duplicate-assign suppression (master PR #40833): a double-click that fires
// two identical `navigateTo(..., { assign: true })` calls within 1s must reach
// `window.location.assign` only once. The dedupe is keyed on the final,
// app-root-prefixed sink value. These exercise the real `navigateTo` (not an
// identity stub) so app-root prefixing and the assign barrier run end to end.
describe('navigateTo duplicate-assign suppression', () => {
  let originalLocation: Location;
  let assignMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    originalLocation = window.location;
    delete (window as unknown as { location?: Location }).location;
    assignMock = jest.fn();
    (
      window as unknown as { location: { href: string; assign: jest.Mock } }
    ).location = { href: '', assign: assignMock };
  });

  afterEach(() => {
    (window as unknown as { location: Location }).location = originalLocation;
    jest.useRealTimers();
  });

  test('ignores a repeated assign to the same URL within the dedupe window', async () => {
    await withApplicationRoot('/superset/', async () => {
      const { navigateTo } = await import('src/utils/navigationUtils');
      navigateTo('/dashboard/new/', { assign: true });
      navigateTo('/dashboard/new/', { assign: true });
      expect(assignMock).toHaveBeenCalledTimes(1);
      expect(assignMock).toHaveBeenCalledWith('/superset/dashboard/new/');
    });
  });

  test('assigns different URLs in quick succession', async () => {
    await withApplicationRoot('/superset/', async () => {
      const { navigateTo } = await import('src/utils/navigationUtils');
      navigateTo('/dashboard/new/', { assign: true });
      navigateTo('/chart/add/', { assign: true });
      expect(assignMock).toHaveBeenCalledTimes(2);
    });
  });

  test('assigns the same URL again once the dedupe window has elapsed', async () => {
    await withApplicationRoot('/superset/', async () => {
      const { navigateTo } = await import('src/utils/navigationUtils');
      navigateTo('/dashboard/new/', { assign: true });
      jest.advanceTimersByTime(1000);
      navigateTo('/dashboard/new/', { assign: true });
      expect(assignMock).toHaveBeenCalledTimes(2);
    });
  });
});

describe('openBlankTab / navigateOpenedTab / closeOpenedTab', () => {
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    // Default to the blocked-popup return so a test that forgets to set one
    // does not fall through to jsdom's unimplemented window.open.
    openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  const makeTab = () =>
    ({
      closed: false,
      close: jest.fn(),
      location: { replace: jest.fn() },
    }) as unknown as Window;

  test('openBlankTab opens the placeholder without noopener so the handle is usable', async () => {
    // Regression: opening a version as new stranded a blank about:blank tab
    // because window.open(..., 'noopener') returns null, so openBlankTab handed
    // the caller no window handle to navigate.
    const tab = makeTab();
    openSpy.mockReturnValue(tab);
    const { openBlankTab } = await import('src/utils/navigationUtils');

    const result = openBlankTab();

    expect(result).toBe(tab);
    // Assert the exact call, not merely the absence of the `noopener` token:
    // `noreferrer` also forces window.open to return null, so a features arg of
    // any kind would reship the stranded-tab bug. Only a two-arg call keeps the
    // handle.
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith('', '_blank');
  });

  test('openBlankTab returns null when the browser blocks the popup', async () => {
    openSpy.mockReturnValue(null);
    const { openBlankTab } = await import('src/utils/navigationUtils');

    // The null is the contract callers rely on to detect a blocked popup.
    expect(openBlankTab()).toBeNull();
  });

  test('navigateOpenedTab points a live claimed tab at the resolved URL', async () => {
    await withApplicationRoot('', async () => {
      const tab = makeTab();
      const { navigateOpenedTab } = await import('src/utils/navigationUtils');

      navigateOpenedTab(tab, '/dashboard/9/');

      expect(tab.location.replace as jest.Mock).toHaveBeenCalledWith(
        '/dashboard/9/',
      );
      // The live-handle branch must NOT fall through to a second window.open,
      // which by the time it runs has lost user activation and is popup-blocked.
      expect(openSpy).not.toHaveBeenCalled();
    });
  });

  test('navigateOpenedTab prefixes the app root before replacing', async () => {
    await withApplicationRoot('/superset/', async () => {
      const tab = makeTab();
      const { navigateOpenedTab } = await import('src/utils/navigationUtils');

      navigateOpenedTab(tab, '/dashboard/9/');

      expect(tab.location.replace as jest.Mock).toHaveBeenCalledWith(
        '/superset/dashboard/9/',
      );
    });
  });

  test('navigateOpenedTab falls back to a fresh window.open when the tab is null', async () => {
    await withApplicationRoot('', async () => {
      openSpy.mockReturnValue(null);
      const { navigateOpenedTab } = await import('src/utils/navigationUtils');

      navigateOpenedTab(null, '/explore/?slice_id=1');

      expect(openSpy).toHaveBeenCalledWith(
        '/explore/?slice_id=1',
        '_blank',
        'noopener noreferrer',
      );
    });
  });

  test('navigateOpenedTab falls back when the claimed tab was already closed', async () => {
    await withApplicationRoot('', async () => {
      const tab = { ...makeTab(), closed: true } as unknown as Window;
      openSpy.mockReturnValue(null);
      const { navigateOpenedTab } = await import('src/utils/navigationUtils');

      navigateOpenedTab(tab, '/explore/?slice_id=1');

      expect(tab.location.replace as jest.Mock).not.toHaveBeenCalled();
      expect(openSpy).toHaveBeenCalledWith(
        '/explore/?slice_id=1',
        '_blank',
        'noopener noreferrer',
      );
    });
  });

  test('navigateOpenedTab does not expose the opener-connected tab to an external URL', async () => {
    await withApplicationRoot('', async () => {
      const tab = makeTab();
      const { navigateOpenedTab } = await import('src/utils/navigationUtils');

      // A safe-but-absolute URL is permitted by assertSafeNavigationUrl, but
      // must not be navigated on the noopener-less claimed tab: it is closed
      // and reopened through the noopener fallback instead.
      navigateOpenedTab(tab, 'https://example.com/');

      expect(tab.location.replace as jest.Mock).not.toHaveBeenCalled();
      expect(tab.close as jest.Mock).toHaveBeenCalledTimes(1);
      expect(openSpy).toHaveBeenCalledWith(
        'https://example.com/',
        '_blank',
        'noopener noreferrer',
      );
    });
  });

  test('navigateOpenedTab validates the URL before touching a claimed tab', async () => {
    await withApplicationRoot('', async () => {
      const tab = makeTab();
      const { navigateOpenedTab } = await import('src/utils/navigationUtils');

      expect(() => navigateOpenedTab(tab, '//evil.com')).toThrow();
      expect(tab.location.replace as jest.Mock).not.toHaveBeenCalled();
      expect(tab.close as jest.Mock).not.toHaveBeenCalled();
      expect(openSpy).not.toHaveBeenCalled();
    });
  });

  test('closeOpenedTab closes a live tab and no-ops on null or already-closed', async () => {
    const { closeOpenedTab } = await import('src/utils/navigationUtils');
    const tab = makeTab();

    closeOpenedTab(tab);
    expect(tab.close as jest.Mock).toHaveBeenCalledTimes(1);

    const closed = { ...makeTab(), closed: true } as unknown as Window;
    closeOpenedTab(closed);
    expect(closed.close as jest.Mock).not.toHaveBeenCalled();

    expect(() => closeOpenedTab(null)).not.toThrow();
  });
});

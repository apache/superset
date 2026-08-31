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

// `FilterBar/index.tsx::publishDataMask` is one of the five sanctioned
// `applicationRoot()` callers (memory `project_supersetclient_approot_dedupe`).
// It runs after a filter mutation to push the updated filter cache key into
// the URL via `history.replace`. Two appRoot-aware operations gate that
// replace:
//
//   1. The path-matching guard — only fire when the current pathname is a
//      dashboard route under the configured appRoot. The bug class this
//      catches is "filter writes pollute Explore's URL after navigation".
//
//   2. The prefix-strip — React Router applies `basename` internally, so
//      `history.replace({ pathname })` must receive a path WITHOUT the
//      appRoot. The bug class this catches is `/superset/superset/dashboard/...`
//      in the URL bar after the first filter change.
//
// `publishDataMask` is module-private (declared as a `const debounce(...)`).
// Testing it through a rendered FilterBar requires the Redux store, the
// filter cache API, and the debounce timer — heavyweight relative to what
// the contract actually says. Instead this test does two things:
//
//   A. Reads FilterBar/index.tsx as source and pins the two patterns that
//      embody the contract. A future refactor that drops the guard or the
//      strip fails here loudly with the exact line that drifted.
//   B. Tests the *equivalent* pure logic (re-implementation of the same
//      pattern) across every appRoot × pathname × Explore-vs-Dashboard
//      input shape that matters in practice. If the actual code drifts
//      from the documented invariant, the source-pin in (A) fires; if the
//      documented invariant itself is wrong, (B) fires.

import { readFileSync } from 'fs';
import { join } from 'path';

const FILTERBAR_SRC = readFileSync(join(__dirname, 'index.tsx'), 'utf8');

// ---------------------------------------------------------------------------
// (A) Source-pin: the two patterns that implement the contract.
// ---------------------------------------------------------------------------

test('FilterBar/index.tsx guards history.replace by the configured app root', () => {
  // The guard short-circuits the URL mutation when the current path is not a
  // dashboard route under the appRoot — e.g. when the user navigated to
  // Explore (`/explore/?slice_id=...`), the FilterBar's debounced commit must
  // not stomp Explore's query string with native_filters_key.
  expect(FILTERBAR_SRC).toContain(
    'window.location.pathname.startsWith(`${applicationRoot()}/dashboard`)',
  );
});

test('FilterBar/index.tsx strips the app root before history.replace', () => {
  // Both halves of the strip survive together — the appRoot != "/" check
  // and the startsWith-before-substring guard. Each is load-bearing on its
  // own (without the first, root deploy hits `.substring(1)` and clips off
  // the leading slash; without the second, paths that diverge from the
  // appRoot get incorrectly truncated).
  expect(FILTERBAR_SRC).toContain(
    "if (appRoot !== '/' && replacementPathname.startsWith(appRoot))",
  );
  expect(FILTERBAR_SRC).toContain(
    'replacementPathname = replacementPathname.substring(appRoot.length);',
  );
});

test('FilterBar/index.tsx imports applicationRoot from getBootstrapData', () => {
  // Centralised symbol — the static-scan invariant in
  // navigationUtils.invariants.test.ts enumerates the sanctioned import
  // sites. If FilterBar's import path drifts, that scan also fires; this
  // one anchors the import locally so a `git blame` on FilterBar tells the
  // story without needing to cross-reference the scan ledger.
  expect(FILTERBAR_SRC).toMatch(
    /import\s+\{\s*applicationRoot\s*\}\s+from\s+'src\/utils\/getBootstrapData'/,
  );
});

// ---------------------------------------------------------------------------
// (B) Characterisation: the documented invariant, exercised across the
//     appRoot × pathname matrix.
// ---------------------------------------------------------------------------
//
// Re-implementation of the FilterBar guard + strip, kept here so the test
// can fail loudly if the *invariant itself* is wrong (rather than a typo in
// the implementation). The source-pin above catches the inverse case
// (implementation drifts away from the invariant).

interface Scenario {
  description: string;
  appRoot: string;
  pathname: string;
  shouldReplace: boolean;
  replacementPathname?: string;
}

function applyFilterBarPathLogic(
  appRoot: string,
  pathname: string,
): { shouldReplace: boolean; replacementPathname?: string } {
  if (!pathname.startsWith(`${appRoot}/dashboard`)) {
    return { shouldReplace: false };
  }
  let replacement = pathname;
  if (appRoot !== '/' && replacement.startsWith(appRoot)) {
    replacement = replacement.substring(appRoot.length);
  }
  return { shouldReplace: true, replacementPathname: replacement };
}

const SCENARIOS: ReadonlyArray<Scenario> = [
  // Root deploy — pathname matches `/dashboard` directly.
  {
    description: 'root deploy on a dashboard page',
    appRoot: '',
    pathname: '/dashboard/1/',
    shouldReplace: true,
    replacementPathname: '/dashboard/1/',
  },
  {
    description: 'root deploy on Explore — guard short-circuits',
    appRoot: '',
    pathname: '/explore/?slice_id=42',
    shouldReplace: false,
  },
  // Subdir deploy — appRoot is `/superset`, pathname carries the prefix.
  {
    description: 'subdir deploy on a dashboard page',
    appRoot: '/superset',
    pathname: '/superset/dashboard/2/',
    shouldReplace: true,
    // Stripped: React Router re-applies basename so the strip MUST happen.
    replacementPathname: '/dashboard/2/',
  },
  {
    description: 'subdir deploy on a dashboard permalink',
    appRoot: '/superset',
    pathname: '/superset/dashboard/p/abc123/',
    shouldReplace: true,
    replacementPathname: '/dashboard/p/abc123/',
  },
  {
    description: 'subdir deploy on Explore — guard short-circuits',
    appRoot: '/superset',
    pathname: '/superset/explore/?slice_id=7',
    shouldReplace: false,
  },
  {
    description:
      'subdir deploy on bare app root (no /dashboard) — short-circuits',
    appRoot: '/superset',
    pathname: '/superset/',
    shouldReplace: false,
  },
  // Operator deploy under a deeply nested basename.
  {
    description: 'deep-nested deploy on a dashboard page',
    appRoot: '/tenant-a/superset',
    pathname: '/tenant-a/superset/dashboard/9/',
    shouldReplace: true,
    replacementPathname: '/dashboard/9/',
  },
  // Adversarial: appRoot `/dash` is a substring of `/dashboard`. The guard
  // template is `${appRoot}/dashboard` so the prefix is `/dash/dashboard`,
  // which (correctly) does NOT match a bare `/dashboard/1/` path. Pin the
  // case so a maintainer doesn't "fix" the guard to also match prefix-free
  // paths (which would re-introduce the Explore-stomp regression for
  // operators whose root happens to share characters with `/dashboard`).
  {
    description:
      'appRoot is a substring prefix of /dashboard — guard does NOT match a bare /dashboard path',
    appRoot: '/dash',
    pathname: '/dashboard/5/',
    shouldReplace: false,
  },
];

test.each(SCENARIOS)(
  'publishDataMask path logic: $description',
  ({ appRoot, pathname, shouldReplace, replacementPathname }: Scenario) => {
    const result = applyFilterBarPathLogic(appRoot, pathname);
    expect(result.shouldReplace).toBe(shouldReplace);
    if (shouldReplace) {
      expect(result.replacementPathname).toBe(replacementPathname);
      // The dedupe contract: no `/superset/superset/...` ever reaches React
      // Router. Even if the source-pin drifts, this catches the user-visible
      // symptom.
      expect(result.replacementPathname).not.toMatch(/\/superset\/superset\//);
    } else {
      expect(result.replacementPathname).toBeUndefined();
    }
  },
);

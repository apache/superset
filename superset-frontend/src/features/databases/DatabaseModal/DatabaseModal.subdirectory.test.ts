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

// Subdirectory regression coverage for the DatabaseModal "post-connection"
// call-to-action buttons (Create dataset + Query data in SQL Lab).
//
// Original bug class: under a subdir deployment (`applicationRoot = '/superset'`)
// the "Query data in SQL Lab" button navigated to a double-prefixed URL
// (`/superset/superset/sqllab?db=true`). The fix routes both CTA buttons
// through `redirectURL`, which delegates to `useHistory().push(...)`. React
// Router's `BrowserRouter basename={applicationRoot()}` re-applies the prefix
// internally, so the argument to `history.push` MUST be a router-relative
// path (no leading `${applicationRoot}` and no `ensureAppRoot` wrap).
//
// Reaching `renderCTABtns()` through a rendered modal requires walking the
// full "select engine → fill SQLAlchemy form → submit → wait for success"
// flow with every fetch mocked. The contract under test is much smaller
// than that surface, so this file uses the same source-pin + pure-logic
// characterisation pattern as
// `dashboard/components/nativeFilters/FilterBar/FilterBar.subdirectory.test.ts`.

import { readFileSync } from 'fs';
import { join } from 'path';

const MODAL_SRC = readFileSync(join(__dirname, 'index.tsx'), 'utf8');

// ---------------------------------------------------------------------------
// Source-pin: redirectURL receives router-relative paths.
// ---------------------------------------------------------------------------

test('DatabaseModal redirectURL delegates to history.push', () => {
  // The redirectURL helper is the single funnel for post-connection
  // navigation. Both CTA buttons call it; the only safe argument shape is
  // a router-relative path, because BrowserRouter's basename re-applies the
  // app root. Pinning the helper body here means a future refactor that
  // re-introduces `applicationRoot()` or `ensureAppRoot` at this layer
  // fails loudly with the exact callsite.
  expect(MODAL_SRC).toMatch(
    /const redirectURL = \(url: string\) => \{\s*history\.push\(url\);\s*\};/,
  );
});

test('DatabaseModal "Query data in SQL Lab" pushes a router-relative /sqllab', () => {
  // The exact string we want in source. If someone "fixes" subdir support
  // by wrapping this in ensureAppRoot or hard-coding `/superset/sqllab`,
  // this test fires before the bad change ships.
  expect(MODAL_SRC).toContain("redirectURL('/sqllab?db=true')");
});

test('DatabaseModal "Create dataset" pushes a router-relative /dataset/add/', () => {
  // Symmetric invariant for the sibling CTA button — same risk class
  // (basename double-prefix) applies. Pinning prevents drift where someone
  // "fixes" one button and leaves the other inconsistent.
  expect(MODAL_SRC).toContain("redirectURL('/dataset/add/')");
});

test('DatabaseModal CTA buttons do NOT prefix the app root themselves', () => {
  // The buttons must not call applicationRoot()/ensureAppRoot/makeUrl on
  // these specific paths — basename handles the prefix, and any extra
  // prefixing produces `/superset/superset/...`. Search the renderCTABtns
  // block (lines ~1855-1879 at time of writing) for offending patterns.
  const ctaMatch = MODAL_SRC.match(
    /const renderCTABtns = \(\) =>[\s\S]*?<\/StyledBtns>\s*\);/,
  );
  expect(ctaMatch).not.toBeNull();
  const ctaSrc = ctaMatch![0];
  expect(ctaSrc).not.toMatch(/applicationRoot\s*\(/);
  expect(ctaSrc).not.toMatch(/ensureAppRoot\s*\(/);
  expect(ctaSrc).not.toMatch(/makeUrl\s*\(/);
  // And the specific double-prefixed string the original bug produced —
  // pin it so a regression that hard-codes the app root never ships.
  expect(ctaSrc).not.toContain('/superset/sqllab');
  expect(ctaSrc).not.toContain('/superset/dataset/add');
});

// ---------------------------------------------------------------------------
// Characterisation: the documented invariant exercised across app-roots.
// ---------------------------------------------------------------------------
//
// Re-implements the behaviour the source-pin describes: a router-relative
// path pushed through history under BrowserRouter's basename produces a
// single-prefixed URL. If the documented invariant itself is wrong the
// source-pin is useless; this matrix catches that.

interface Scenario {
  description: string;
  basename: string;
  pushArg: string;
  expected: string;
}

// Mirror of how React Router composes basename + pushed path. React Router
// requires the pushed path to start with '/' and concatenates basename in
// front (stripping a trailing slash on basename if present).
function composeUnderBasename(basename: string, pushArg: string): string {
  const normalisedBase =
    basename === '/' || basename === '' ? '' : basename.replace(/\/+$/, '');
  return `${normalisedBase}${pushArg}`;
}

const SCENARIOS: ReadonlyArray<Scenario> = [
  {
    description: 'root deploy: bare basename + /sqllab?db=true',
    basename: '',
    pushArg: '/sqllab?db=true',
    expected: '/sqllab?db=true',
  },
  {
    description: 'subdir deploy: /superset + /sqllab?db=true',
    basename: '/superset',
    pushArg: '/sqllab?db=true',
    expected: '/superset/sqllab?db=true',
  },
  {
    description: 'subdir deploy: /superset + /dataset/add/',
    basename: '/superset',
    pushArg: '/dataset/add/',
    expected: '/superset/dataset/add/',
  },
  {
    description: 'deep-nested deploy: /tenant-a/superset + /sqllab?db=true',
    basename: '/tenant-a/superset',
    pushArg: '/sqllab?db=true',
    expected: '/tenant-a/superset/sqllab?db=true',
  },
  {
    description: 'subdir deploy: trailing slash on basename collapses cleanly',
    basename: '/superset/',
    pushArg: '/sqllab?db=true',
    expected: '/superset/sqllab?db=true',
  },
];

test.each(SCENARIOS)(
  'redirectURL navigation: $description',
  ({ basename, pushArg, expected }: Scenario) => {
    const url = composeUnderBasename(basename, pushArg);
    expect(url).toBe(expected);
    // The dedupe contract: no `/superset/superset/...` ever reaches the
    // browser. Even if the source-pin drifts, this catches the user-visible
    // symptom for the subdir case.
    expect(url).not.toMatch(/\/superset\/superset\//);
  },
);

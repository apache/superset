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
import { applicationRootScenarios } from 'spec/helpers/withApplicationRoot';

// Subdirectory regression for the five direct-DOM-navigation callsites
// migrated:
//
//   src/components/Datasource/components/DatasourceEditor/DatasourceEditor.tsx:1163
//     → openInNewTab(this.getSQLLabUrl())
//   src/SqlLab/components/ResultSet/index.tsx:315
//     → openInNewTab(url)            // url = mountExploreUrl(..., true)
//   src/SqlLab/components/ResultSet/index.tsx:384
//     → redirect(getExportCsvUrl(query.id))
//   src/SqlLab/components/SaveDatasetModal/index.tsx:252
//     → openInNewTab(url)            // url = mountExploreUrl(..., true)
//   src/SqlLab/components/SaveDatasetModal/index.tsx:254
//     → redirect(url)
//
// Each migrated callsite hands an already-app-rooted URL to the helper
// (because the upstream URL builder — `makeUrl`, `mountExploreUrl(...,
// includeAppRoot=true)` — has already applied the root). The helper must
// produce a single-prefix URL under both deployments via the `ensureAppRoot`
// idempotence safety net. The previous direct `window.open` / `window.location`
// calls bypassed both `ensureAppRoot` (would double-prefix if the upstream
// URL changed) and `assertSafeNavigationUrl` (open-redirect surface) — this
// suite locks in that the helper now owns both responsibilities.
//
// We assert on the URL handed to the underlying DOM API rather than rendering
// any of the three components (DatasourceEditor, ResultSet, SaveDatasetModal),
// because the migration is purely a value-wrap on `window.open` /
// `window.location.href` — there is no rendered surface that changes shape.

interface Callsite {
  /** Human-friendly identifier (`file:line — helper(arg-shape)`). */
  name: string;
  /** Helper invoked at the migrated callsite. */
  helper: 'openInNewTab' | 'redirect';
  /**
   * The literal value the upstream URL builder hands to the helper at
   * runtime, parameterised by the deployment root. For the migrated
   * callsites this is always an already-app-rooted URL (idempotent re-
   * application is the contract).
   */
  input: (root: string) => string;
  /** The single-prefix URL the helper must hand to the underlying DOM API. */
  expected: (root: string) => string;
}

const CALLSITES: Callsite[] = [
  {
    name: 'DatasourceEditor:1163 — openInNewTab(makeUrl(/sqllab/?...))',
    helper: 'openInNewTab',
    input: root => `${root}/sqllab/?datasourceKey=42`,
    expected: root => `${root}/sqllab/?datasourceKey=42`,
  },
  {
    name: 'ResultSet:315 — openInNewTab(mountExploreUrl(..., true))',
    helper: 'openInNewTab',
    input: root => `${root}/explore/?form_data_key=abc123`,
    expected: root => `${root}/explore/?form_data_key=abc123`,
  },
  {
    name: 'ResultSet:384 — redirect(getExportCsvUrl(id))',
    helper: 'redirect',
    input: root => `${root}/api/v1/sqllab/export/42/`,
    expected: root => `${root}/api/v1/sqllab/export/42/`,
  },
  {
    name: 'SaveDatasetModal:252 — openInNewTab(mountExploreUrl(..., true))',
    helper: 'openInNewTab',
    input: root => `${root}/explore/?form_data_key=def456`,
    expected: root => `${root}/explore/?form_data_key=def456`,
  },
  {
    name: 'SaveDatasetModal:254 — redirect(mountExploreUrl(..., true))',
    helper: 'redirect',
    input: root => `${root}/explore/?form_data_key=ghi789`,
    expected: root => `${root}/explore/?form_data_key=ghi789`,
  },
];

const DEPLOYMENTS: { label: string; root: string }[] = [
  { label: 'root deployment', root: '' },
  { label: '/superset subdirectory deployment', root: '/superset' },
];

test('helpers hand the correct single-prefix URL to the DOM under both deployments', async () => {
  // Capture the original window.location.href descriptor so we can restore
  // it after each scenario; jsdom defines it as a getter/setter on the
  // Location prototype and we need a plain assignment to spy on.
  const originalLocation = window.location;
  const originalOpen = window.open;

  await applicationRootScenarios(DEPLOYMENTS, async ({ root }) => {
    const { openInNewTab, redirect } =
      await import('src/utils/navigationUtils');

    for (const callsite of CALLSITES) {
      // Re-stub per callsite so cross-row contamination cannot mask a bug.
      const openSpy = jest.fn();
      window.open = openSpy as unknown as typeof window.open;

      // `window.location.href = ...` is a setter on the Location object; we
      // replace `window.location` entirely with a writable href stub. jsdom
      // permits this when configurable=true (it is by default in jest-jsdom).
      const hrefStub: { value: string } = { value: '' };
      Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: {
          get href() {
            return hrefStub.value;
          },
          set href(next: string) {
            hrefStub.value = next;
          },
          assign(next: string) {
            hrefStub.value = next;
          },
        },
      });

      const input = callsite.input(root);
      const expected = callsite.expected(root);

      if (callsite.helper === 'openInNewTab') {
        openInNewTab(input);
        expect({
          deployment: root || '(root)',
          callsite: callsite.name,
          actual: openSpy.mock.calls[0]?.[0],
        }).toEqual({
          deployment: root || '(root)',
          callsite: callsite.name,
          actual: expected,
        });
      } else {
        redirect(input);
        expect({
          deployment: root || '(root)',
          callsite: callsite.name,
          actual: hrefStub.value,
        }).toEqual({
          deployment: root || '(root)',
          callsite: callsite.name,
          actual: expected,
        });
      }
    }
  });

  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
  window.open = originalOpen;
});

// Open-redirect guard: the helpers route every URL through
// `assertSafeNavigationUrl`, which rejects backslash-laden paths, protocol-
// relative authorities, and `javascript:` / `data:` schemes. The pre-migration
// raw `window.open(url, ...)` / `window.location.href = url` callsites had
// no such guard; pin the post-migration safety so a future "simplify"
// refactor cannot accidentally re-introduce the open-redirect surface.
test('openInNewTab / redirect reject open-redirect URL shapes', async () => {
  await applicationRootScenarios(
    [{ label: '/superset subdirectory deployment', root: '/superset' }],
    async () => {
      const { openInNewTab, redirect } =
        await import('src/utils/navigationUtils');
      // `redirect` swallows the throw inside `navigateTo` (logs + falls
      // back to ensureAppRoot('/'))). `openInNewTab` calls
      // `assertSafeNavigationUrl` directly and propagates the throw.
      const consoleErrSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      try {
        // Protocol-relative authority — would navigate cross-origin.
        expect(() => openInNewTab('//evil.example.com/x')).toThrow(
          /unsafe URL/,
        );
        // Backslash-laden authority — browsers normalise `/\evil` → `//evil`.
        expect(() => openInNewTab('/legit\\evil.example.com')).toThrow(
          /unsafe URL/,
        );
        // `javascript:` is neutralised by `ensureAppRoot` (prefixed into a
        // path segment, e.g. `/superset/javascript:alert(1)`), so the
        // helper does NOT throw — the contract is "the URL handed to
        // window.open is a relative path, never a script-scheme". Verify
        // the prefix path by stubbing window.open and reading the arg.
        const sideEffectSpy = jest.fn();
        window.open = sideEffectSpy as unknown as typeof window.open;
        // Construct the literal piecewise so oxlint's `no-script-url` rule
        // does not flag the test for the exact shape it is asserting the
        // navigation guard neutralises.
        const scriptScheme = `${'java'}${'script:'}alert(1)`;
        openInNewTab(scriptScheme);
        expect(sideEffectSpy).toHaveBeenCalledWith(
          `/superset/${scriptScheme}`,
          '_blank',
          'noopener noreferrer',
        );
        // `redirect` falls back to the home page rather than throwing.
        const hrefStub: { value: string } = { value: '' };
        Object.defineProperty(window, 'location', {
          configurable: true,
          writable: true,
          value: {
            get href() {
              return hrefStub.value;
            },
            set href(next: string) {
              hrefStub.value = next;
            },
            assign(next: string) {
              hrefStub.value = next;
            },
          },
        });
        redirect('//evil.example.com/x');
        expect(hrefStub.value).toBe('/superset/');
      } finally {
        consoleErrSpy.mockRestore();
      }
    },
  );
});

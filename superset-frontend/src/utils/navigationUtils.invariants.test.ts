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
  expectNoHits,
  scanSource,
  type ScanHit,
} from 'spec/helpers/sourceTreeScanner';

// Hits whose source line is a comment are not real violations. The scanner is
// line-based and cannot tell apart `const u = '/superset/x'` from `// example
// '/superset/x'` — explanatory JSDoc and block comments that reference the
// doubled-prefix bug intentionally contain the literal. Strip comments from
// each line and re-test the original pattern against what's left.
//
// The previous line-based predicate dropped any
// line beginning with `/*`, which silently swallowed shapes like
// `/* ignore */ window.open('/x')` — executable code following an inline
// block comment. The structural strip below removes block-comment and
// line-comment segments inline and re-runs the caller's pattern; only lines
// whose substantive content still matches survive.
function dropCommentLines(hits: ScanHit[], pattern: RegExp): ScanHit[] {
  // Use a fresh, non-global RegExp instance for `.test()` so any `g` flag on
  // the caller's pattern does not skew lastIndex across invocations.
  const testRegex = pattern.flags.includes('g')
    ? new RegExp(pattern.source, pattern.flags.replace('g', ''))
    : pattern;
  return hits.filter(({ text }) => {
    let stripped = text.replace(/\/\*[\s\S]*?\*\//g, '');
    stripped = stripped.replace(/\/\/.*$/, '');
    const collapsed = stripped.trim();
    if (collapsed === '') return false;
    // JSDoc continuation in a multi-line block comment (no closer on this
    // line): a leading `*`, the standalone closer `*/`, or an unclosed
    // `/*` / `/**` opener.
    if (
      collapsed === '*' ||
      collapsed === '*/' ||
      collapsed.startsWith('* ') ||
      (collapsed.startsWith('/*') && !collapsed.includes('*/'))
    ) {
      return false;
    }
    return testRegex.test(collapsed);
  });
}

// Synthetic regression — pins the structural strip behaviour above.
// Mutate `dropCommentLines` back to the line-based form and this fails on
// the `/* ignore */ window.open(...)` row, the exact evasion shape the
// rewrite closes.
test('dropCommentLines: strips comments structurally, not by leading marker', () => {
  const synthetic: ScanHit[] = [
    {
      file: 'src/synthetic.ts',
      line: 1,
      text: "/* ignore */ window.open('/x')",
      match: 'window.open(',
    },
    {
      file: 'src/synthetic.ts',
      line: 2,
      text: '/* pure inline block comment */',
      match: '',
    },
    {
      file: 'src/synthetic.ts',
      line: 3,
      text: "* `window.open('/x')` inside JSDoc continuation",
      match: 'window.open(',
    },
    {
      file: 'src/synthetic.ts',
      line: 4,
      text: "callSite(); // window.open('/x') trailing-comment example",
      match: 'window.open(',
    },
    {
      file: 'src/synthetic.ts',
      line: 5,
      text: "window.open('/x') // real call with trailing note",
      match: 'window.open(',
    },
  ];
  const surviving = dropCommentLines(synthetic, /\bwindow\.open\(/);
  // Lines 1 and 5 have executable `window.open(` after stripping; the
  // others are comment-only and must be dropped.
  expect(surviving.map(h => h.line)).toEqual([1, 5]);
});

test('no file outside navigationUtils.ts imports from pathUtils', () => {
  // pathUtils.ts is the implementation module; navigationUtils.ts re-exports
  // its helpers as the single sanctioned entry point for the rest of the
  // codebase. Callers should `import { ensureAppRoot } from
  // 'src/utils/navigationUtils'` (or use the focused helpers there).
  const hits = scanSource({
    pattern: /from\s+['"](?:src\/utils\/pathUtils|\.\.?\/[\w./]*pathUtils)['"]/,
    allowlist: ['src/utils/navigationUtils.ts'],
  });

  expectNoHits(
    hits,
    'Found direct imports from src/utils/pathUtils. Import from ' +
      'src/utils/navigationUtils instead — it re-exports ensureAppRoot ' +
      'and makeUrl, and exposes focused helpers (openInNewTab, redirect, ' +
      'getShareableUrl, AppLink) for most call sites.',
  );
});

// Raw absolute-from-root anchor hrefs (`href="/foo"`, `href={`/foo`}`, etc.)
// bypass React Router's basename when rendered with `target="_blank"` and
// produce 404s under subdirectory deployment. Migrate to either
// `<AppLink href={...}>` or wrap with `ensureAppRoot()` so the application
// root is applied exactly once.
//
// The negative lookbehind `(?<!\.)` excludes `obj.href = '/'` — that case
// belongs to the navigateTo / window.location migration. Negative lookahead
// `(?!\/)` excludes protocol-relative URLs (`href="//cdn..."`).
const RAW_HREF_ABSOLUTE_PATH_PATTERN =
  /(?<!\.)\bhref\s*=\s*(?:["']\/(?!\/)|\{\s*["']\/(?!\/)|\{\s*`\/(?!\/))/;

// 7 entries removed; all callsites
// migrated to `<AppLink>` (plain `<a>`) or `ensureAppRoot(...)` value-wrap
// (antd `<Button href>`, `<Typography.Link href>`). The two scan + stale-
// allowlist tests below now enforce a genuine zero on the RAW_HREF surface.
const RAW_HREF_ABSOLUTE_PATH_ALLOWLIST: string[] = [];

test('no raw absolute-path href in JSX outside the migration allow-list', () => {
  const hits = scanSource({
    pattern: RAW_HREF_ABSOLUTE_PATH_PATTERN,
    allowlist: RAW_HREF_ABSOLUTE_PATH_ALLOWLIST,
  });

  expectNoHits(
    hits,
    'Found raw absolute-path href anchors. With target="_blank" these ' +
      "bypass React Router's basename and 404 under /superset deployment. " +
      'Migrate to <AppLink href={...}> from src/utils/navigationUtils, or ' +
      'wrap the value with ensureAppRoot().',
  );
});

test('RAW_HREF_ABSOLUTE_PATH_ALLOWLIST has no stale entries', () => {
  // Every allow-listed file must still contain at least one raw-href
  // violation. When a migration commit removes the last violation from a
  // file, that file must be dropped from the allow-list in the same commit
  // — otherwise the scan silently stops protecting the rest of the tree
  // from regressions in that file.
  const hitFiles = new Set(
    scanSource({ pattern: RAW_HREF_ABSOLUTE_PATH_PATTERN }).map(
      hit => hit.file,
    ),
  );

  const stale = RAW_HREF_ABSOLUTE_PATH_ALLOWLIST.filter(
    file => !hitFiles.has(file),
  );

  expect(stale).toEqual([]);
});

// Direct `applicationRoot()` calls are the escape hatch for reading
// the deployment root. The sanctioned shape is to route everything through
// `navigationUtils` helpers (which delegate to pathUtils.ensureAppRoot /
// makeUrl). Only a small set of modules legitimately needs the raw root: the
// definition itself, the bootstrap entry points that hand `appRoot` to
// `setupClient`, the router basename wiring, and the pathUtils
// implementation.
const APPLICATION_ROOT_CALL_PATTERN = /\bapplicationRoot\s*\(/;

const APPLICATION_ROOT_CALL_ALLOWLIST: string[] = [
  // Sanctioned: definition + the 5 modules described in the project memory.
  'src/utils/getBootstrapData.ts',
  'src/utils/pathUtils.ts',
  'src/preamble.ts',
  'src/views/App.tsx',
  'src/embedded/index.tsx',
  // Migration targets: still call applicationRoot() directly to build paths
  // outside the helper. Replace with ensureAppRoot / stripAppRoot /
  // navigationUtils before dropping from this list.
  'src/dashboard/components/nativeFilters/FilterBar/index.tsx',
  'src/components/StreamingExportModal/useStreamingExport.ts',
];

test('applicationRoot() is called only from sanctioned modules', () => {
  const hits = dropCommentLines(
    scanSource({
      pattern: APPLICATION_ROOT_CALL_PATTERN,
      allowlist: APPLICATION_ROOT_CALL_ALLOWLIST,
    }),
    APPLICATION_ROOT_CALL_PATTERN,
  );

  expectNoHits(
    hits,
    'Found direct applicationRoot() calls outside the sanctioned set. ' +
      'Most call sites should route through navigationUtils helpers ' +
      '(ensureAppRoot / makeUrl / openInNewTab / AppLink) so the app root ' +
      'is applied exactly once. If a new caller genuinely needs the raw ' +
      'root, justify it and add the file to APPLICATION_ROOT_CALL_ALLOWLIST.',
  );
});

test('APPLICATION_ROOT_CALL_ALLOWLIST has no stale entries', () => {
  const hitFiles = new Set(
    dropCommentLines(
      scanSource({ pattern: APPLICATION_ROOT_CALL_PATTERN }),
      APPLICATION_ROOT_CALL_PATTERN,
    ).map(hit => hit.file),
  );

  const stale = APPLICATION_ROOT_CALL_ALLOWLIST.filter(
    file => !hitFiles.has(file),
  );

  expect(stale).toEqual([]);
});

// Direct DOM navigation (`window.open(...)`, `window.location.href = ...`,
// `window.location.assign(...)`, `window.location.replace(...)`) bypasses
// `navigationUtils.openInNewTab` / `redirect` and therefore skips both
// `ensureAppRoot` and the `assertSafeNavigationUrl` scheme guard. Under
// subdirectory deployment they emit unprefixed paths that 404; in the open-
// redirect threat model they accept `javascript:` / protocol-relative URLs
// that the helpers refuse. Migration target: replace with the navigationUtils
// helpers, or — for mailto:/external schemes — keep the raw call and add a
// localized justification + this allow-list entry.
const DIRECT_DOM_NAV_PATTERN =
  /\bwindow\.(?:open\(|location\.(?:href\s*=|assign\(|replace\()|history\.(?:pushState\(|replaceState\())/;

// SANCTIONED: files that legitimately call window.open / window.location /
// window.history directly because the helpers themselves live here, or the
// call shape is intentionally outside the navigationUtils contract (mailto:
// links, OAuth popup-handle capture, external-doc opener, full-page login
// redirect inside the HTTP client). The set is permanent; adding to it
// requires a documented justification adjacent to the entry.
const DIRECT_DOM_NAV_SANCTIONED: string[] = [
  // Owns the helpers: openInNewTab / redirect / navigateTo / navigateWithState
  // are the only callers that should reach for window.* in src/.
  'src/utils/navigationUtils.ts',
  // Dashboard reload-to-self after a layout change — `window.location.assign`
  // is intentionally a full-page nav and the URL is already app-rooted.
  'src/dashboard/components/Header/index.tsx',
  // `mailto:` schemes are not router-relative; helpers reject them via the
  // assertSafeNavigationUrl guard.
  'src/dashboard/components/menu/ShareMenuItems/index.tsx',
  'src/explore/components/useExploreAdditionalActionsMenu/index.tsx',
  // SupersetClient login redirect: full-page reload to a server-built
  // `${appRoot}/login?next=...` URL inside the connection layer, before
  // navigationUtils is available.
  'packages/superset-ui-core/src/connection/SupersetClientClass.ts',
  // External documentation links opened via a user-supplied URL — the
  // navigationUtils guard would reject any non-http(s) value here.
  'packages/superset-ui-core/src/components/Form/LabeledErrorBoundInput.tsx',
];

// MIGRATION TARGETS: files that still call window.* directly and should be
// drained to zero. The last three were drained (DatasourceEditor,
// ResultSet, SaveDatasetModal); future direct-DOM navigations must either
// migrate immediately or earn a justified SANCTIONED entry above.
const DIRECT_DOM_NAV_ALLOWLIST: string[] = [];

test('no direct window.open/window.location navigation outside navigationUtils', () => {
  const hits = dropCommentLines(
    scanSource({
      pattern: DIRECT_DOM_NAV_PATTERN,
      allowlist: [...DIRECT_DOM_NAV_SANCTIONED, ...DIRECT_DOM_NAV_ALLOWLIST],
    }),
    DIRECT_DOM_NAV_PATTERN,
  );

  expectNoHits(
    hits,
    'Found direct window.open / window.location / window.history navigation. ' +
      'These bypass ensureAppRoot (broken under subdirectory deployment) ' +
      'and the assertSafeNavigationUrl scheme guard (open-redirect surface). ' +
      'Replace with openInNewTab / redirect / navigateWithState from ' +
      'src/utils/navigationUtils.',
  );
});

test('DIRECT_DOM_NAV_SANCTIONED has no stale entries', () => {
  const hitFiles = new Set(
    dropCommentLines(
      scanSource({ pattern: DIRECT_DOM_NAV_PATTERN }),
      DIRECT_DOM_NAV_PATTERN,
    ).map(hit => hit.file),
  );

  const stale = DIRECT_DOM_NAV_SANCTIONED.filter(file => !hitFiles.has(file));

  expect(stale).toEqual([]);
});

test('DIRECT_DOM_NAV_ALLOWLIST has no stale entries', () => {
  const hitFiles = new Set(
    dropCommentLines(
      scanSource({ pattern: DIRECT_DOM_NAV_PATTERN }),
      DIRECT_DOM_NAV_PATTERN,
    ).map(hit => hit.file),
  );

  const stale = DIRECT_DOM_NAV_ALLOWLIST.filter(file => !hitFiles.has(file));

  expect(stale).toEqual([]);
});

// Hard-coded `/superset/...` path literals in source bake the legacy
// `route_base` into the frontend and double-prefix under subdirectory
// deployment. The backend now serves these endpoints under their own
// blueprint routes (e.g. `/dashboard/<id>/`, `/explore/...`, `/sqllab/`),
// and the helper-aware shape is `ensureAppRoot('/dashboard/<id>/')`.
//
// Match a quote/backtick followed by `/superset` followed by `/` or a
// closing quote. The lookahead also allows `?` and `#` so query/hash
// shapes don't slip through.
const HARDCODED_SUPERSET_LITERAL_PATTERN = /['"`]\/superset(?:[/?#]|['"`])/;

// Empty: the last entries (`ChartList`/`DashboardList` testHelpers) were
// dropped once `Dashboard.url` / `Slice.url` / `SqlaTable.explore_url` stopped
// returning `/superset/...` and the fixtures were updated to the live shapes
// (`/dashboard/<id>/`, `/explore/?slice_id=<id>`,
// `/explore/?datasource_type=table&datasource_id=<id>`). Kept as an empty
// constant — paired with the stale-entry guard below — so a future migration
// can re-introduce a temporary entry without re-deriving the mechanism.
const HARDCODED_SUPERSET_LITERAL_ALLOWLIST: string[] = [];

test('no hard-coded /superset/ path literals outside the migration allow-list', () => {
  const hits = dropCommentLines(
    scanSource({
      pattern: HARDCODED_SUPERSET_LITERAL_PATTERN,
      allowlist: HARDCODED_SUPERSET_LITERAL_ALLOWLIST,
    }),
    HARDCODED_SUPERSET_LITERAL_PATTERN,
  );

  expectNoHits(
    hits,
    'Found hard-coded /superset/ path literal in source. Under subdirectory ' +
      'deployment these become /<approot>/superset/... (doubled prefix) ' +
      'and after the `Superset.route_base = ""` cleanup most are 404s. ' +
      'Replace with the post-route_base route (e.g. /dashboard/<id>/, ' +
      '/explore/...) and let ensureAppRoot apply the deployment root.',
  );
});

test('HARDCODED_SUPERSET_LITERAL_ALLOWLIST has no stale entries', () => {
  const hitFiles = new Set(
    dropCommentLines(
      scanSource({ pattern: HARDCODED_SUPERSET_LITERAL_PATTERN }),
      HARDCODED_SUPERSET_LITERAL_PATTERN,
    ).map(hit => hit.file),
  );

  const stale = HARDCODED_SUPERSET_LITERAL_ALLOWLIST.filter(
    file => !hitFiles.has(file),
  );

  expect(stale).toEqual([]);
});

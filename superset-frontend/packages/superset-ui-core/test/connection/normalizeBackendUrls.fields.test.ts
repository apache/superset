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
  normalizeBackendUrls,
  NORMALIZED_URL_FIELDS,
  NORMALIZER_EXCLUSIONS,
} from '../../src/connection/normalizeBackendUrls';

const PREFIX = '/superset';

// Contract test (P0-1, surfaced by the 2026-06-02 subdirectory test-gap audit).
//
// The runtime normaliser uses a closed allow-list. Adding a new backend
// `*_url` field that the allow-list doesn't know about is a silent failure
// mode — under `APPLICATION_ROOT=/superset` the frontend re-prefixes the
// field and produces `/superset/superset/...`. The bug only surfaces in
// production, manually, when someone reports a doubled URL.
//
// These tests pin two contracts that catch the failure mode in CI:
//   1. The allow-list and the exclusion ledger are exhaustive for every
//      backend `*_url` field the frontend can encounter today.
//   2. The allow-list and the exclusion ledger are disjoint (a field is
//      either normalised or explicitly exempt, never both).
//
// When a backend schema adds a new `*_url` field, the contributor must
// classify it here — normalise (add to NORMALIZED_URL_FIELDS) or exempt
// (add to NORMALIZER_EXCLUSIONS with a reason). Both branches force a
// conscious decision rather than the silent default.

/**
 * Known backend `*_url` fields that reach the frontend payload.
 *
 * Sources (grepped 2026-06-02 against `master` + subdir branch):
 *   - `superset/charts/schemas.py` — slice_url, chart_url, thumbnail_url
 *   - `superset/dashboards/schemas.py` — dashboard_url, image_url, edit_url, thumbnail_url, url
 *   - `superset/datasource/schemas.py` — explore_url
 *   - `superset/databases/schemas.py` — none today
 *   - `superset/models/slice.py.data` — slice_url, edit_url
 *   - `superset/models/dashboard.py.data` — url (router-relative)
 *   - bootstrap payload — bug_report_url, documentation_url
 *
 * Convention: backend properties that build paths inline (`f"/explore/..."`)
 * emit router-relative paths and frontend `ensureAppRoot` is correct as-is.
 * Backend callers that use `get_url_path()` emit fully-qualified absolute
 * URLs (skipped by SAFE_ABSOLUTE_URL_RE). The single field that historically
 * emits a prefixed router-relative path is `explore_url` (the
 * `default_endpoint` branch in `connectors/sqla/models.py:402` can hold any
 * operator-saved string, commonly the prefixed `/superset/explore/...`).
 */
const KNOWN_BACKEND_URL_FIELDS: ReadonlyArray<string> = [
  // Allow-list members (must be normalised; backend may emit prefixed):
  'explore_url',
  // Exclusion-list members (intentionally NOT normalised — see EXCLUSIONS reasons):
  'bug_report_url',
  'documentation_url',
  'external_url',
  'bundle_url',
  'tracking_url',
  'user_login_url',
  'user_logout_url',
  'user_info_url',
  'thumbnail_url',
  'creator_url',
];

test('NORMALIZED_URL_FIELDS contains exactly the documented allow-list', () => {
  // Snapshot of the allow-list. Changing this is a deliberate contract
  // change — update KNOWN_BACKEND_URL_FIELDS above + grep evidence to keep
  // the audit fresh.
  expect([...NORMALIZED_URL_FIELDS].sort()).toEqual(['explore_url']);
});

test('NORMALIZER_EXCLUSIONS contains exactly the documented exclusions', () => {
  // Snapshot of the exclusion ledger. Each entry has a `reason` so a future
  // maintainer can decide whether the rationale still holds when the
  // backend convention changes.
  expect(NORMALIZER_EXCLUSIONS.map(({ field }) => field).sort()).toEqual(
    [
      'bug_report_url',
      'bundle_url',
      'creator_url',
      'documentation_url',
      'external_url',
      'thumbnail_url',
      'tracking_url',
      'user_info_url',
      'user_login_url',
      'user_logout_url',
    ].sort(),
  );
});

test('every known backend *_url field is either normalised or exempt', () => {
  const allowList = new Set(NORMALIZED_URL_FIELDS);
  const exclusionList = new Set(
    NORMALIZER_EXCLUSIONS.map(({ field }) => field),
  );
  const unclassified = KNOWN_BACKEND_URL_FIELDS.filter(
    field => !allowList.has(field) && !exclusionList.has(field),
  );
  expect(unclassified).toEqual([]);
});

test('allow-list and exclusion ledger are disjoint', () => {
  const exclusionList = NORMALIZER_EXCLUSIONS.map(({ field }) => field);
  const overlap = exclusionList.filter(field =>
    NORMALIZED_URL_FIELDS.has(field),
  );
  expect(overlap).toEqual([]);
});

test('NORMALIZER_EXCLUSIONS entries each carry a non-empty reason', () => {
  // The `reason` column is the only context a future contributor has when
  // deciding whether to graduate an exclusion to the allow-list. An empty
  // reason is worse than no entry — it implies a decision was made when in
  // fact none was recorded.
  for (const { field, reason } of NORMALIZER_EXCLUSIONS) {
    expect(reason).toBeTruthy();
    expect(reason.length).toBeGreaterThan(3);
    expect(typeof field).toBe('string');
  }
});

// Behavioural assertions per known field — these are the runtime contracts
// the allow-list + exclusion classification translates into. If a future
// refactor moves a field between buckets without updating the runtime, this
// is where the symptom surfaces.

test('allow-listed fields with prefixed values are stripped to router-relative', () => {
  const input = {
    explore_url: '/superset/explore/?datasource_type=table&datasource_id=1',
  };
  expect(normalizeBackendUrls(input, { applicationRoot: PREFIX })).toEqual({
    explore_url: '/explore/?datasource_type=table&datasource_id=1',
  });
});

test('exempt fields are passed through even when prefixed-looking', () => {
  // `thumbnail_url` and friends may legitimately be `/superset/...` (when the
  // storage host happens to share the deployment origin) or fully external
  // (S3). The normaliser leaves them alone in both cases — frontend treats
  // the value as opaque.
  const input = {
    thumbnail_url: '/superset/thumbnail/abc',
    bug_report_url: 'https://github.com/apache/superset/issues',
    user_logout_url: '/superset/logout/',
  };
  expect(normalizeBackendUrls(input, { applicationRoot: PREFIX })).toEqual(
    input,
  );
});

test('router-relative non-prefixed values on allow-listed fields are untouched', () => {
  // `slice_url` / `edit_url` etc. are router-relative by backend convention
  // (no `/superset` prefix). When the value doesn't start with the root,
  // the normaliser passes it through. This pin protects against a future
  // change that would aggressively strip a leading slash or rewrite a
  // non-matching value.
  const input = { explore_url: '/explore/?slice_id=42' };
  expect(normalizeBackendUrls(input, { applicationRoot: PREFIX })).toEqual(
    input,
  );
});

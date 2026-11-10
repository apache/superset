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

/**
 * @fileoverview Applying a held write reloads onto the real chart.
 *
 * The reload was always wired. It just came back through `form_data_key`,
 * which after a held save holds the live, pre-application form data, and the
 * explore GET lets a cached key override the slice's own params. So the
 * applied chart reloaded as the old one until the chart was reopened from
 * a URL with no key (sc-131032).
 *
 * Confirmed against a running instance before this was written: caching a
 * form_data with a marker value and then asking
 * `/api/v1/explore/?form_data_key=...&slice_id=1` returned the marker, not
 * the live slice's value.
 */

import { navigateWithState } from 'src/utils/navigationUtils';
import { reloadFromTheServer } from '.';

jest.mock('src/utils/navigationUtils', () => ({
  ...jest.requireActual('src/utils/navigationUtils'),
  navigateWithState: jest.fn(),
}));

// `history.replaceState` through `navigateWithState`, rather than
// `location.replace` directly: the direct sink skips `ensureAppRoot`, which
// is wrong under a subdirectory deployment, and the scheme guard that keeps
// a computed navigation from being an open-redirect surface. Both keep the
// stale-key URL out of the back button; only one of them is safe.
const rewrite = navigateWithState as jest.Mock;
const original = window.location;
const reload = jest.fn();

beforeAll(() => {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...original, reload } as unknown as Location,
  });
});

afterAll(() => {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: original,
  });
});

beforeEach(() => {
  rewrite.mockClear();
  reload.mockClear();
});

const at = (href: string): void => {
  (window.location as unknown as { href: string }).href = href;
  reloadFromTheServer();
};

// The path and query it rewrote to, resolved against the page it was on so
// a caller can read parameters off it. `navigateWithState` is handed a
// router-relative path, not an absolute URL -- `ensureAppRoot` adds the
// deployment root, which is the whole reason for going through it.
const reloadFrom = (href: string): string =>
  new URL(
    (at(href), rewrite.mock.calls[0][0] as string),
    'http://localhost:8088',
  ).toString();

test('the cached form data is dropped, so the slice is read instead', () => {
  const next = reloadFrom(
    'http://localhost:8088/explore/?form_data_key=abc123&slice_id=7',
  );

  expect(next).not.toContain('form_data_key');
  expect(next).toContain('slice_id=7');
});

test('every other parameter is left alone', () => {
  // `slice_id` is what the GET falls through to, so losing it would reload
  // an empty Explore rather than the real chart.
  const next = reloadFrom(
    'http://localhost:8088/explore/?form_data_key=abc&slice_id=7&standalone=1&foo=bar',
  );

  const params = new URL(next).searchParams;
  expect(params.get('slice_id')).toBe('7');
  expect(params.get('standalone')).toBe('1');
  expect(params.get('foo')).toBe('bar');
  expect(params.has('form_data_key')).toBe(false);
});

test('a URL that never had the key is reloaded, not re-navigated', () => {
  // `replace` to the same URL does not reload when the URL has a fragment:
  // that is a same-document navigation. The plain reload this replaced
  // always reloaded, so with nothing to drop we must still reload.
  at('http://localhost:8088/explore/?slice_id=7');

  expect(reload).toHaveBeenCalledTimes(1);
  expect(rewrite).not.toHaveBeenCalled();
});

test('a URL with a fragment and no key still reloads', () => {
  at('http://localhost:8088/explore/?slice_id=7#panel');

  expect(reload).toHaveBeenCalledTimes(1);
  expect(rewrite).not.toHaveBeenCalled();
});

test('a key with no slice_id reloads rather than opening an empty Explore', () => {
  // Dropping the key is only safe because the GET falls through to
  // slice_id. With no slice_id there is nothing to fall through to.
  at('http://localhost:8088/explore/?form_data_key=abc');

  expect(reload).toHaveBeenCalledTimes(1);
  expect(rewrite).not.toHaveBeenCalled();
});

test('it replaces rather than pushes, so back does not return to the stale URL', () => {
  reloadFrom('http://localhost:8088/explore/?form_data_key=abc&slice_id=7');

  expect(rewrite).toHaveBeenCalledTimes(1);
  expect(rewrite.mock.calls[0][2]).toEqual({ replace: true });
  // It rewrites and does not load, so the reload still has to follow.
  expect(reload).toHaveBeenCalledTimes(1);
});

test('an empty slice_id reloads rather than opening an empty Explore', () => {
  // `searchParams.has` is true for `?slice_id=`, so the key would have been
  // dropped and the GET left with nothing to fall through to.
  at('http://localhost:8088/explore/?form_data_key=abc&slice_id=');

  expect(reload).toHaveBeenCalledTimes(1);
  expect(rewrite).not.toHaveBeenCalled();
});

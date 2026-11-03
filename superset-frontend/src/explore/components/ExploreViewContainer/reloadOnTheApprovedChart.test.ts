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
 * @fileoverview Approving a chart change reloads onto the approved chart.
 *
 * The reload was always wired. It just came back through `form_data_key`,
 * which after a held save holds the live, pre-approval form data, and the
 * explore GET lets a cached key override the slice's own params. So the
 * approved chart reloaded as the old one until the chart was reopened from
 * a URL with no key (sc-131032).
 *
 * Confirmed against a running instance before this was written: caching a
 * form_data with a marker value and then asking
 * `/api/v1/explore/?form_data_key=...&slice_id=1` returned the marker, not
 * the live slice's value.
 */

import { reloadOnTheApprovedChart } from '.';

const replace = jest.fn();
const original = window.location;

beforeAll(() => {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...original, replace, reload } as unknown as Location,
  });
});

afterAll(() => {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: original,
  });
});

beforeEach(() => {
  replace.mockClear();
  reload.mockClear();
});

const reload = jest.fn();

const at = (href: string): void => {
  (window.location as unknown as { href: string }).href = href;
  reloadOnTheApprovedChart();
};

const reloadFrom = (href: string): string => {
  at(href);
  return replace.mock.calls[0][0] as string;
};

test('the cached form data is dropped, so the slice is read instead', () => {
  const next = reloadFrom(
    'http://localhost:8088/explore/?form_data_key=abc123&slice_id=7',
  );

  expect(next).not.toContain('form_data_key');
  expect(next).toContain('slice_id=7');
});

test('every other parameter is left alone', () => {
  // `slice_id` is what the GET falls through to, so losing it would reload
  // an empty Explore rather than the approved chart.
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
  expect(replace).not.toHaveBeenCalled();
});

test('a URL with a fragment and no key still reloads', () => {
  at('http://localhost:8088/explore/?slice_id=7#panel');

  expect(reload).toHaveBeenCalledTimes(1);
  expect(replace).not.toHaveBeenCalled();
});

test('a key with no slice_id reloads rather than opening an empty Explore', () => {
  // Dropping the key is only safe because the GET falls through to
  // slice_id. With no slice_id there is nothing to fall through to.
  at('http://localhost:8088/explore/?form_data_key=abc');

  expect(reload).toHaveBeenCalledTimes(1);
  expect(replace).not.toHaveBeenCalled();
});

test('it replaces rather than pushes, so back does not return to the stale URL', () => {
  reloadFrom('http://localhost:8088/explore/?form_data_key=abc&slice_id=7');

  expect(replace).toHaveBeenCalledTimes(1);
});

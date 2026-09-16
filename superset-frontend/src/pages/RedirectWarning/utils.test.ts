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

import { isAllowedScheme, getTargetUrl, isUrlTrusted, trustUrl } from './utils';

const TRUSTED_URLS_KEY = 'superset_trusted_urls';

beforeEach(() => {
  localStorage.clear();
});

test('isAllowedScheme accepts http URLs', () => {
  expect(isAllowedScheme('http://example.com')).toBe(true);
});

test('isAllowedScheme accepts https URLs', () => {
  expect(isAllowedScheme('https://example.com/page?q=1')).toBe(true);
});

test('isAllowedScheme blocks javascript: URLs', () => {
  // oxlint-disable-next-line no-script-url -- testing that dangerous schemes are blocked
  expect(isAllowedScheme('javascript:alert(1)')).toBe(false);
});

test('isAllowedScheme blocks data: URLs', () => {
  expect(isAllowedScheme('data:text/html,<script>alert(1)</script>')).toBe(
    false,
  );
});

test('isAllowedScheme blocks vbscript: URLs', () => {
  expect(isAllowedScheme('vbscript:MsgBox("XSS")')).toBe(false);
});

test('isAllowedScheme blocks file: URLs', () => {
  expect(isAllowedScheme('file:///etc/passwd')).toBe(false);
});

test('isAllowedScheme allows relative URLs (unparseable as absolute)', () => {
  expect(isAllowedScheme('/dashboard/1')).toBe(true);
});

test('isAllowedScheme blocks protocol-relative URLs', () => {
  // `new URL('//evil.example.com')` throws standalone, so without the
  // explicit guard the catch branch would let cross-origin protocol-
  // relative URLs through as "relative".
  expect(isAllowedScheme('//evil.example.com')).toBe(false);
  expect(isAllowedScheme('//evil.example.com/phish?token=abc')).toBe(false);
});

test('isAllowedScheme does not block single-leading-slash absolute paths', () => {
  // Guard against an over-broad fix that strips both `//` and `/foo`.
  expect(isAllowedScheme('/dashboard/list/')).toBe(true);
});

// The up-front
// `startsWith('//')` check missed backslash variants. `new URL('/\\evil.com')`
// throws → the catch returns `true` (allow) → the interstitial UI shows
// `/\evil.com` inside an "External link warning" Card with a Continue
// button. Browsers normalise `/\` → `//` in the special-scheme authority,
// so the consented click became `https://evil.com`. The fix must reject
// **before** the `new URL` attempt so the throw cannot route through the
// allow branch.

test('isAllowedScheme blocks /\\evil.com (backslash variant)', () => {
  expect(isAllowedScheme('/\\evil.example.com')).toBe(false);
});

test('isAllowedScheme blocks \\/evil.com (backslash variant)', () => {
  expect(isAllowedScheme('\\/evil.example.com')).toBe(false);
});

test('isAllowedScheme blocks \\\\evil.com (backslash variant)', () => {
  expect(isAllowedScheme('\\\\evil.example.com')).toBe(false);
});

test('isAllowedScheme blocks /\\evil.com BEFORE the new URL attempt (not via the catch)', () => {
  // Stub `URL` to throw — the result must still be `false`, proving the
  // backslash rejection happens up-front and not via the catch's
  // "relative URLs — allow" branch. (If the rejection were inside the
  // try-block, a URL-constructor throw would route through `catch { return
  // true }` and we'd see `true` here.)
  const originalURL = global.URL;
  global.URL = class {
    constructor() {
      throw new Error('stubbed URL constructor');
    }
  } as unknown as typeof URL;
  try {
    expect(isAllowedScheme('/\\evil.example.com')).toBe(false);
  } finally {
    global.URL = originalURL;
  }
});

test('isAllowedScheme still blocks the catch-branch protocol-relative case after backslash rejection', () => {
  // Regression: hardening must not accidentally drop the existing `//host`
  // protection.
  expect(isAllowedScheme('//evil.example.com')).toBe(false);
});

test('getTargetUrl reads the url query parameter', () => {
  const locationSpy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    search: '?url=https%3A%2F%2Fexample.com%2Fpage',
  } as Location);
  expect(getTargetUrl()).toBe('https://example.com/page');
  locationSpy.mockRestore();
});

test('getTargetUrl returns empty string when url param is missing', () => {
  const locationSpy = jest
    .spyOn(window, 'location', 'get')
    .mockReturnValue({ search: '' } as Location);
  expect(getTargetUrl()).toBe('');
  locationSpy.mockRestore();
});

test('getTargetUrl does not double-decode percent-encoded values', () => {
  // %253A is the double-encoding of ":" — after one decode it should remain %3A
  const locationSpy = jest
    .spyOn(window, 'location', 'get')
    .mockReturnValue({ search: '?url=javascript%253Aalert(1)' } as Location);
  expect(getTargetUrl()).toBe('javascript%3Aalert(1)');
  locationSpy.mockRestore();
});

test('trustUrl stores and isUrlTrusted retrieves a URL', () => {
  const url = 'https://example.com/page';
  expect(isUrlTrusted(url)).toBe(false);
  trustUrl(url);
  expect(isUrlTrusted(url)).toBe(true);
});

test('isUrlTrusted normalizes URLs for comparison', () => {
  trustUrl('https://example.com/page/');
  expect(isUrlTrusted('https://example.com/page')).toBe(true);
});

test('trustUrl does not add duplicates', () => {
  trustUrl('https://example.com');
  trustUrl('https://example.com');
  const stored = JSON.parse(
    localStorage.getItem(TRUSTED_URLS_KEY) ?? '[]',
  ) as string[];
  expect(stored).toHaveLength(1);
});

test('isUrlTrusted returns false when localStorage contains invalid data', () => {
  localStorage.setItem(TRUSTED_URLS_KEY, '"not-an-array"');
  expect(isUrlTrusted('https://example.com')).toBe(false);
});

test('isUrlTrusted returns false when localStorage contains a non-array object', () => {
  localStorage.setItem(TRUSTED_URLS_KEY, '{"foo":"bar"}');
  expect(isUrlTrusted('https://example.com')).toBe(false);
});

test('trustUrl caps storage at 100 entries', () => {
  const urls = Array.from({ length: 105 }, (_, i) => `https://example${i}.com`);
  urls.forEach(url => trustUrl(url));
  const stored = JSON.parse(
    localStorage.getItem(TRUSTED_URLS_KEY) ?? '[]',
  ) as string[];
  expect(stored.length).toBeLessThanOrEqual(100);
  // The most recent entries should be kept
  expect(stored).toContain('https://example104.com');
});

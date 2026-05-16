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

test('getTargetUrl reads the url query parameter', () => {
  Object.defineProperty(window, 'location', {
    value: { search: '?url=https%3A%2F%2Fexample.com%2Fpage' },
    writable: true,
  });
  expect(getTargetUrl()).toBe('https://example.com/page');
});

test('getTargetUrl returns empty string when url param is missing', () => {
  Object.defineProperty(window, 'location', {
    value: { search: '' },
    writable: true,
  });
  expect(getTargetUrl()).toBe('');
});

test('getTargetUrl does not double-decode percent-encoded values', () => {
  // %253A is the double-encoding of ":" — after one decode it should remain %3A
  Object.defineProperty(window, 'location', {
    value: { search: '?url=javascript%253Aalert(1)' },
    writable: true,
  });
  expect(getTargetUrl()).toBe('javascript%3Aalert(1)');
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

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
import { SupersetClient } from '@superset-ui/core';
import {
  addCspAllowlistEntry,
  CSP_ALLOWLIST_ENDPOINT,
  fetchCspAllowlist,
  getOrigin,
  isEmbeddableUrl,
} from './cspAllowlist';

test('getOrigin extracts the bare origin from a URL', () => {
  expect(getOrigin('https://example.com/path?q=1#frag')).toBe(
    'https://example.com',
  );
  expect(getOrigin('https://example.com:8443/x')).toBe(
    'https://example.com:8443',
  );
  expect(getOrigin('http://localhost:9000')).toBe('http://localhost:9000');
});

test('getOrigin returns null for empty or unparseable URLs', () => {
  expect(getOrigin('')).toBeNull();
  expect(getOrigin(undefined)).toBeNull();
  expect(getOrigin('not a url')).toBeNull();
  expect(getOrigin('example.com')).toBeNull();
});

test('isEmbeddableUrl is true only for absolute http(s) URLs', () => {
  expect(isEmbeddableUrl('https://example.com')).toBe(true);
  expect(isEmbeddableUrl('http://example.com/embed')).toBe(true);
  expect(isEmbeddableUrl('ftp://example.com')).toBe(false);
  // built via concatenation to avoid a literal javascript: URL in source
  expect(isEmbeddableUrl(`${'java'}${'script'}:alert(1)`)).toBe(false);
  expect(isEmbeddableUrl('')).toBe(false);
  expect(isEmbeddableUrl(undefined)).toBe(false);
});

test('fetchCspAllowlist returns the set of origins for frame-src', async () => {
  const getSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: {
      result: [
        { domain: 'https://a.com', directive: 'frame-src' },
        { domain: 'https://b.com', directive: 'frame-src' },
        { domain: 'https://c.com', directive: 'img-src' },
      ],
    },
  } as any);

  const allowlist = await fetchCspAllowlist();
  expect(getSpy).toHaveBeenCalledWith({ endpoint: CSP_ALLOWLIST_ENDPOINT });
  expect(allowlist.has('https://a.com')).toBe(true);
  expect(allowlist.has('https://b.com')).toBe(true);
  // img-src entries are excluded from the frame-src set
  expect(allowlist.has('https://c.com')).toBe(false);

  getSpy.mockRestore();
});

test('addCspAllowlistEntry posts the origin with the frame-src directive', async () => {
  const postSpy = jest
    .spyOn(SupersetClient, 'post')
    .mockResolvedValue({} as any);

  await addCspAllowlistEntry('https://example.com');
  expect(postSpy).toHaveBeenCalledWith({
    endpoint: CSP_ALLOWLIST_ENDPOINT,
    jsonPayload: { domain: 'https://example.com', directive: 'frame-src' },
  });

  postSpy.mockRestore();
});

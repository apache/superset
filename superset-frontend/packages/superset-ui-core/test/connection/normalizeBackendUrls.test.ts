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
import { normalizeBackendUrlString } from '../../src/connection/normalizeBackendUrls';

const PREFIX = '/superset';

describe('normalizeBackendUrlString', () => {
  test('strips application root from a router-relative path', () => {
    expect(
      normalizeBackendUrlString('/superset/explore/?slice_id=1', {
        applicationRoot: PREFIX,
      }),
    ).toBe('/explore/?slice_id=1');
  });

  test('strips a value that equals the application root exactly', () => {
    expect(
      normalizeBackendUrlString('/superset', { applicationRoot: PREFIX }),
    ).toBe('/');
  });

  test('tolerates a trailing slash on applicationRoot', () => {
    expect(
      normalizeBackendUrlString('/superset/foo', {
        applicationRoot: '/superset/',
      }),
    ).toBe('/foo');
  });

  // The negative cases below prove the helper is conservative: it doesn't
  // mutate external URLs or path segments that merely share text with the root.
  test('passes absolute URLs through unchanged', () => {
    expect(
      normalizeBackendUrlString('https://external.example.com/superset/foo', {
        applicationRoot: PREFIX,
      }),
    ).toBe('https://external.example.com/superset/foo');
  });

  test('passes protocol-relative URLs through unchanged', () => {
    expect(
      normalizeBackendUrlString('//cdn.example.com/superset/foo', {
        applicationRoot: PREFIX,
      }),
    ).toBe('//cdn.example.com/superset/foo');
  });

  test('does not strip a similar-but-different prefix segment', () => {
    // /superset-public/... shares text with /superset but is a different path
    // segment. Only /superset followed by / or end-of-string counts.
    expect(
      normalizeBackendUrlString('/superset-public/explore/?slice_id=1', {
        applicationRoot: PREFIX,
      }),
    ).toBe('/superset-public/explore/?slice_id=1');
  });

  test('is a no-op when application root is empty', () => {
    expect(
      normalizeBackendUrlString('/superset/explore/?slice_id=1', {
        applicationRoot: '',
      }),
    ).toBe('/superset/explore/?slice_id=1');
  });

  test('is idempotent: normalize(normalize(x)) === normalize(x)', () => {
    const once = normalizeBackendUrlString('/superset/explore/?id=1', {
      applicationRoot: PREFIX,
    });
    const twice = normalizeBackendUrlString(once, { applicationRoot: PREFIX });
    expect(twice).toBe(once);
  });
});

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
  normalizeBackendUrlString,
  NORMALIZED_URL_FIELDS,
  NORMALIZE_MAX_DEPTH,
} from '../../src/connection/normalizeBackendUrls';

const PREFIX = '/superset';

describe('normalizeBackendUrls', () => {
  test('strips application root from a recognised URL field', () => {
    const input = { id: 1, explore_url: '/superset/explore/?slice_id=1' };
    const output = normalizeBackendUrls(input, { applicationRoot: PREFIX });
    expect(output).toEqual({ id: 1, explore_url: '/explore/?slice_id=1' });
  });

  // The negative cases below prove the normaliser is conservative: it doesn't
  // mutate user content, external URLs, or path segments that merely share
  // text with the configured root.
  test('leaves non-allow-listed fields untouched even when path-shaped', () => {
    const input = { description: '/superset/just-text-from-a-user' };
    expect(normalizeBackendUrls(input, { applicationRoot: PREFIX })).toEqual(
      input,
    );
  });

  test('leaves absolute URLs untouched in recognised fields', () => {
    const input = { explore_url: 'https://other.example.com/superset/foo' };
    expect(normalizeBackendUrls(input, { applicationRoot: PREFIX })).toEqual(
      input,
    );
  });

  test('leaves protocol-relative URLs untouched', () => {
    const input = { explore_url: '//cdn.example.com/superset/foo' };
    expect(normalizeBackendUrls(input, { applicationRoot: PREFIX })).toEqual(
      input,
    );
  });

  test('does not strip a similar-but-different prefix segment', () => {
    // /superset-public/... shares text with /superset but is a different path
    // segment. Only /superset followed by / or end-of-string counts.
    const input = { explore_url: '/superset-public/explore/?slice_id=1' };
    expect(normalizeBackendUrls(input, { applicationRoot: PREFIX })).toEqual(
      input,
    );
  });

  test('is a no-op when application root is empty', () => {
    const input = { explore_url: '/explore/?slice_id=1' };
    expect(normalizeBackendUrls(input, { applicationRoot: '' })).toEqual(input);
  });
});

describe('normalizeBackendUrlString', () => {
  test('strips application root from a router-relative path', () => {
    expect(
      normalizeBackendUrlString('/superset/sqllab', {
        applicationRoot: PREFIX,
      }),
    ).toBe('/sqllab');
  });

  test('passes absolute URLs through unchanged', () => {
    expect(
      normalizeBackendUrlString('https://external.example.com/foo', {
        applicationRoot: PREFIX,
      }),
    ).toBe('https://external.example.com/foo');
  });

  test('is a no-op when application root is empty', () => {
    expect(
      normalizeBackendUrlString('/superset/sqllab', { applicationRoot: '' }),
    ).toBe('/superset/sqllab');
  });
});

test('NORMALIZED_URL_FIELDS is a Set for O(1) lookup', () => {
  expect(NORMALIZED_URL_FIELDS).toBeInstanceOf(Set);
});

describe('normalizeBackendUrls (recursion + identity)', () => {
  test('descends into arrays and normalises matching fields per element', () => {
    const input = [
      { explore_url: '/superset/explore/?id=1' },
      { explore_url: '/superset/explore/?id=2' },
    ];
    expect(normalizeBackendUrls(input, { applicationRoot: PREFIX })).toEqual([
      { explore_url: '/explore/?id=1' },
      { explore_url: '/explore/?id=2' },
    ]);
  });

  test('descends into nested objects', () => {
    const input = {
      result: { chart: { explore_url: '/superset/explore/?id=1' } },
    };
    expect(normalizeBackendUrls(input, { applicationRoot: PREFIX })).toEqual({
      result: { chart: { explore_url: '/explore/?id=1' } },
    });
  });

  test('returns input by reference when nothing changed', () => {
    const input = { explore_url: '/explore/?id=1' };
    const output = normalizeBackendUrls(input, { applicationRoot: PREFIX });
    expect(output).toBe(input);
  });

  test('is idempotent: normalize(normalize(x)) === normalize(x)', () => {
    const input = { explore_url: '/superset/explore/?id=1' };
    const once = normalizeBackendUrls(input, { applicationRoot: PREFIX });
    const twice = normalizeBackendUrls(once, { applicationRoot: PREFIX });
    expect(twice).toEqual(once);
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

  test('does not descend into class instances (Date, Map)', () => {
    const date = new Date('2026-01-01');
    const input = { created_at: date };
    const output = normalizeBackendUrls(input, { applicationRoot: PREFIX });
    expect(output.created_at).toBe(date);
  });

  test('descends into null-prototype objects', () => {
    // JSON.parse with a reviver or Object.create(null) maps have no
    // Object.prototype; the walker must still treat them as plain data.
    const input: Record<string, unknown> = Object.create(null);
    input.explore_url = '/superset/explore/?id=1';
    expect(normalizeBackendUrls(input, { applicationRoot: PREFIX })).toEqual({
      explore_url: '/explore/?id=1',
    });
  });

  test('returns an array by reference when nothing inside changed', () => {
    const input = [{ explore_url: '/explore/?id=1' }];
    const output = normalizeBackendUrls(input, { applicationRoot: PREFIX });
    expect(output).toBe(input);
  });
});

describe('normalizeBackendUrls (AF-6 walk hardening)', () => {
  test('exports a finite recursion depth ceiling', () => {
    expect(typeof NORMALIZE_MAX_DEPTH).toBe('number');
    expect(NORMALIZE_MAX_DEPTH).toBeGreaterThan(0);
    expect(Number.isFinite(NORMALIZE_MAX_DEPTH)).toBe(true);
  });

  test('terminates without stack-overflow on a self-referential object', () => {
    type Cyclic = { explore_url: string; self?: Cyclic };
    const cyclic: Cyclic = { explore_url: '/superset/explore/?id=1' };
    cyclic.self = cyclic;
    const output = normalizeBackendUrls(cyclic, { applicationRoot: PREFIX });
    expect(output.explore_url).toBe('/explore/?id=1');
  });

  test('terminates without stack-overflow on a self-referential array', () => {
    const arr: unknown[] = [{ explore_url: '/superset/explore/?id=1' }];
    arr.push(arr);
    const output = normalizeBackendUrls(arr, { applicationRoot: PREFIX }) as [
      { explore_url: string },
      unknown,
    ];
    expect(output[0].explore_url).toBe('/explore/?id=1');
  });

  test('stops descending past NORMALIZE_MAX_DEPTH and returns subtree unchanged', () => {
    type Nested = { explore_url?: string; child?: Nested };
    const buried: Nested = {
      explore_url: '/superset/explore/?id=deep',
    };
    let cursor: Nested = { child: buried };
    for (let i = 0; i < NORMALIZE_MAX_DEPTH + 5; i += 1) {
      cursor = { child: cursor };
    }
    const output = normalizeBackendUrls(cursor, { applicationRoot: PREFIX });
    // Walk into the structure following `child` pointers; once we pass the
    // depth ceiling, the deep `explore_url` must remain unstripped.
    let probe: Nested | undefined = output;
    while (probe?.explore_url === undefined && probe?.child !== undefined) {
      probe = probe.child;
    }
    expect(probe?.explore_url).toBe('/superset/explore/?id=deep');
  });
});

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
  getDatasetFreshness,
  getFreshnessMode,
  setDatasetFreshness,
} from '../datasetFreshness';

test('getDatasetFreshness reads the stored setting', () => {
  expect(
    getDatasetFreshness(
      '{"freshness": {"column": "loaded_at", "warn_after_minutes": 60}}',
    ),
  ).toEqual({ column: 'loaded_at', sql: undefined, warn_after_minutes: 60 });
});

test.each([undefined, '', '{}', 'not json', '{"freshness": "loaded_at"}'])(
  'getDatasetFreshness returns an empty setting for %p',
  extra => {
    expect(getDatasetFreshness(extra)).toEqual({});
  },
);

test('getFreshnessMode', () => {
  expect(getFreshnessMode({})).toBe('none');
  expect(getFreshnessMode({ column: 'a' })).toBe('column');
  expect(getFreshnessMode({ sql: 'SELECT 1' })).toBe('sql');
});

test('setDatasetFreshness keeps the other extra keys', () => {
  const extra = setDatasetFreshness(
    '{"warning_markdown": "careful", "certification": {"certified_by": "x"}}',
    { column: 'loaded_at', warn_after_minutes: 30 },
  );
  expect(JSON.parse(extra as string)).toEqual({
    warning_markdown: 'careful',
    certification: { certified_by: 'x' },
    freshness: { column: 'loaded_at', warn_after_minutes: 30 },
  });
});

test('setDatasetFreshness stores only one mode', () => {
  const extra = setDatasetFreshness('{}', {
    column: 'loaded_at',
    sql: 'SELECT MAX(x) FROM t',
  });
  expect(JSON.parse(extra as string)).toEqual({
    freshness: { sql: 'SELECT MAX(x) FROM t' },
  });
});

test('setDatasetFreshness removes an incomplete setting', () => {
  expect(
    JSON.parse(
      setDatasetFreshness(
        '{"freshness": {"column": "a"}, "warning_markdown": "w"}',
        { sql: '  ', warn_after_minutes: 10 },
      ) as string,
    ),
  ).toEqual({ warning_markdown: 'w' });
});

test('setDatasetFreshness leaves extra untouched when nothing changes', () => {
  expect(setDatasetFreshness('{ "a": 1 }', {})).toBe('{ "a": 1 }');
  expect(setDatasetFreshness(undefined, {})).toBeUndefined();
});

test('setDatasetFreshness leaves malformed extra alone', () => {
  expect(setDatasetFreshness('{"a":', { column: 'x' })).toBe('{"a":');
});

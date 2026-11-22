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

import { normalizeMetadataCacheTimeouts } from './utils';

test('converts numeric string timeouts to integers', () => {
  const result = normalizeMetadataCacheTimeouts(
    JSON.stringify({
      engine_params: {},
      metadata_cache_timeout: {
        schema_cache_timeout: '600',
        table_cache_timeout: '1800',
        catalog_cache_timeout: 5,
      },
    }),
  );
  expect(JSON.parse(result as string)).toEqual({
    engine_params: {},
    metadata_cache_timeout: {
      schema_cache_timeout: 600,
      table_cache_timeout: 1800,
      catalog_cache_timeout: 5,
    },
  });
});

test('leaves non-numeric and negative strings for the backend to reject', () => {
  const extra = JSON.stringify({
    metadata_cache_timeout: {
      schema_cache_timeout: 'abc',
      table_cache_timeout: '-5',
      catalog_cache_timeout: '1.5',
    },
  });
  expect(normalizeMetadataCacheTimeouts(extra)).toBe(extra);
});

test('returns the input unchanged when there is nothing to normalize', () => {
  const noTimeouts = '{"engine_params":{}}';
  const ints = '{"metadata_cache_timeout":{"table_cache_timeout":1800}}';
  expect(normalizeMetadataCacheTimeouts(noTimeouts)).toBe(noTimeouts);
  expect(normalizeMetadataCacheTimeouts(ints)).toBe(ints);
  expect(normalizeMetadataCacheTimeouts('not json')).toBe('not json');
  expect(normalizeMetadataCacheTimeouts('[]')).toBe('[]');
  expect(normalizeMetadataCacheTimeouts('')).toBe('');
  expect(normalizeMetadataCacheTimeouts(undefined)).toBeUndefined();
});

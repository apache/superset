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
  getAllowedGroupByColumns,
  pruneGroupByDataMask,
} from './columnAllowlist';

test('is unrestricted when neither an allowlist nor the groupable set is known', () => {
  expect(getAllowedGroupByColumns(undefined, undefined)).toBeNull();
  expect(getAllowedGroupByColumns([], [])).toBeNull();
});

test('uses the allowlist, narrowed to groupable columns when known', () => {
  expect(getAllowedGroupByColumns(['a', 'b'], undefined)).toEqual(
    new Set(['a', 'b']),
  );
  expect(getAllowedGroupByColumns(undefined, ['a', 'c'])).toEqual(
    new Set(['a', 'c']),
  );
  expect(getAllowedGroupByColumns(['a', 'b'], ['a', 'c'])).toEqual(
    new Set(['a']),
  );
});

const mask = (value: string[]) => ({
  extraFormData: { custom_form_data: { groupby: value } },
  filterState: { label: value.join(', '), value },
});

test('drops excluded columns from a Group By data mask', () => {
  expect(pruneGroupByDataMask(mask(['a', 'x']), new Set(['a']))).toEqual(
    mask(['a']),
  );
});

test('clears the selection when every column is excluded', () => {
  expect(pruneGroupByDataMask(mask(['x']), new Set(['a']))).toEqual({
    extraFormData: { custom_form_data: { groupby: [] } },
    filterState: { label: '', value: null },
  });
});

test('returns the same mask when nothing is excluded or unrestricted', () => {
  const allowedMask = mask(['a']);
  expect(pruneGroupByDataMask(allowedMask, new Set(['a', 'b']))).toBe(
    allowedMask,
  );
  expect(pruneGroupByDataMask(allowedMask, null)).toBe(allowedMask);
  const empty = {};
  expect(pruneGroupByDataMask(empty, new Set(['a']))).toBe(empty);
});

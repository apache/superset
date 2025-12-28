/*
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

import { computeCollapsedMap } from '../../src/react-pivottable/TableRenderers';
import { flatKey } from '../../src/react-pivottable/utilities';

test('computeCollapsedMap returns empty object when depth is 0', () => {
  const keys = [['A'], ['A', 'B'], ['A', 'B', 'C']];
  expect(computeCollapsedMap(keys, 0)).toEqual({});
});

test('computeCollapsedMap returns empty object when depth is negative', () => {
  const keys = [['A'], ['A', 'B'], ['A', 'B', 'C']];
  expect(computeCollapsedMap(keys, -1)).toEqual({});
});

test('computeCollapsedMap returns empty object when depth is undefined', () => {
  const keys = [['A'], ['A', 'B'], ['A', 'B', 'C']];
  // @ts-expect-error testing undefined input
  expect(computeCollapsedMap(keys, undefined)).toEqual({});
});

test('computeCollapsedMap collapses keys at depth 1', () => {
  const keys = [
    ['A'],
    ['A', 'X'],
    ['A', 'Y'],
    ['B'],
    ['B', 'Z'],
  ];
  const result = computeCollapsedMap(keys, 1);
  expect(result).toEqual({
    [flatKey(['A'])]: true,
    [flatKey(['B'])]: true,
  });
});

test('computeCollapsedMap collapses keys at depth 2', () => {
  const keys = [
    ['A'],
    ['A', 'X'],
    ['A', 'X', '1'],
    ['A', 'X', '2'],
    ['A', 'Y'],
    ['B'],
    ['B', 'Z'],
  ];
  const result = computeCollapsedMap(keys, 2);
  expect(result).toEqual({
    [flatKey(['A', 'X'])]: true,
    [flatKey(['A', 'Y'])]: true,
    [flatKey(['B', 'Z'])]: true,
  });
});

test('computeCollapsedMap returns empty object when no keys match the depth', () => {
  const keys = [['A'], ['B'], ['C']];
  // Depth 2, but all keys are only length 1
  expect(computeCollapsedMap(keys, 2)).toEqual({});
});

test('computeCollapsedMap handles empty keys array', () => {
  expect(computeCollapsedMap([], 1)).toEqual({});
});


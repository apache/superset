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

import { renderHook } from '@testing-library/react-hooks';
import { useFilteredTableData } from '.';

const data = [
  { col01: 'some', col02: 'data' },
  { col01: 'any', col02: 'data' },
  { col01: 'some', col02: 'thing' },
  { col01: 'any', col02: 'things' },
];

test('Empty filter', () => {
  const hook = renderHook(() => useFilteredTableData('', data));
  expect(hook.result.current).toEqual(data);
});

test('Filter by the word "data"', () => {
  const hook = renderHook(() => useFilteredTableData('data', data));
  expect(hook.result.current).toEqual([
    { col01: 'some', col02: 'data' },
    { col01: 'any', col02: 'data' },
  ]);
});

test('Filter by the word "thing"', () => {
  const hook = renderHook(() => useFilteredTableData('thing', data));
  expect(hook.result.current).toEqual([
    { col01: 'some', col02: 'thing' },
    { col01: 'any', col02: 'things' },
  ]);
});

test('Filter by the word "any"', () => {
  const hook = renderHook(() => useFilteredTableData('any', data));
  expect(hook.result.current).toEqual([
    { col01: 'any', col02: 'data' },
    { col01: 'any', col02: 'things' },
  ]);
});

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
import { alphabeticalSort, numericalSort } from './sorters';

const rows = [
  {
    name: 'Deathstar Lamp',
    category: 'Lamp',
    cost: 75.99,
  },
  {
    name: 'Desk Lamp',
    category: 'Lamp',
    cost: 15.99,
  },
  {
    name: 'Bedside Lamp',
    category: 'Lamp',
    cost: 15.99,
  },
  { name: 'Drafting Desk', category: 'Desk', cost: 125 },
  { name: 'Sit / Stand Desk', category: 'Desk', cost: 275.99 },
];

/**
 * NOTE:  Sorters for antd table use < 0, 0, > 0 for sorting
 * -1 or less means the first item comes after the second item
 * 0 means the items sort values is equivalent
 * 1 or greater means the first item comes before the second item
 */
test('alphabeticalSort sorts correctly', () => {
  expect(alphabeticalSort('name', rows[0], rows[1])).toBe(-1);
  expect(alphabeticalSort('name', rows[1], rows[0])).toBe(1);
  expect(alphabeticalSort('category', rows[1], rows[0])).toBe(0);
});

test('numericalSort sorts correctly', () => {
  expect(numericalSort('cost', rows[1], rows[2])).toBe(0);
  expect(numericalSort('cost', rows[1], rows[0])).toBeLessThan(0);
  expect(numericalSort('cost', rows[4], rows[1])).toBeGreaterThan(0);
});

/**
 * We want to make sure our sorters do not throw runtime errors given bad inputs.
 * Runtime Errors in a sorter will cause a catastrophic React lifecycle error and produce white screen of death
 * In the case the sorter cannot perform the comparison it should return undefined and the next sort step will proceed without error
 */
test('alphabeticalSort bad inputs no errors', () => {
  // @ts-ignore
  expect(alphabeticalSort('name', null, null)).toBe(undefined);
  // incorrect non-object values
  // @ts-ignore
  expect(alphabeticalSort('name', 3, [])).toBe(undefined);
  // incorrect object values without specificed key
  expect(alphabeticalSort('name', {}, {})).toBe(undefined);
  // Object as value for name when it should be a string
  expect(
    alphabeticalSort(
      'name',
      { name: { title: 'the name attribute should not be an object' } },
      { name: 'Doug' },
    ),
  ).toBe(undefined);
});

test('numericalSort bad inputs no errors', () => {
  // @ts-ignore
  expect(numericalSort('name', undefined, undefined)).toBe(NaN);
  // @ts-ignore
  expect(numericalSort('name', null, null)).toBe(NaN);
  // incorrect non-object values
  // @ts-ignore
  expect(numericalSort('name', 3, [])).toBe(NaN);
  // incorrect object values without specified key
  expect(numericalSort('name', {}, {})).toBe(NaN);
  // Object as value for name when it should be a string
  expect(
    numericalSort(
      'name',
      { name: { title: 'the name attribute should not be an object' } },
      { name: 'Doug' },
    ),
  ).toBe(NaN);
});

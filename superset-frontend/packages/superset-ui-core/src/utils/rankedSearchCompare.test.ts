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

import { rankedSearchCompare } from './rankedSearchCompare';

const searchSort = (search: string) => (a: string, b: string) =>
  rankedSearchCompare(a, b, search);

test('Sort exact match first', async () => {
  expect(['abc', 'bc', 'bcd', 'cbc'].sort(searchSort('bc'))).toEqual([
    'bc',
    'bcd',
    'abc',
    'cbc',
  ]);
});

test('Sort starts with first', async () => {
  expect(['her', 'Cher', 'Her', 'Hermon'].sort(searchSort('Her'))).toEqual([
    'Her',
    'Hermon',
    'her',
    'Cher',
  ]);
  expect(
    ['abc', 'ab', 'aaabc', 'bbabc', 'BBabc'].sort(searchSort('abc')),
  ).toEqual(['abc', 'aaabc', 'bbabc', 'BBabc', 'ab']);
});

test('Sort same case first', async () => {
  expect(['%f %B', '%F %b'].sort(searchSort('%F'))).toEqual(['%F %b', '%f %B']);
});

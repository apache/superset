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
import transformData from '../src/transformData';

const t1 = 1704067200000;
const t2 = 1704153600000;

test('nests records per metric and group with null padding', () => {
  const data = transformData(
    [
      { __timestamp: t1, gender: 'boy', sum__num: 10 },
      { __timestamp: t2, gender: 'boy', sum__num: 20 },
      { __timestamp: t1, gender: 'girl', sum__num: 30 },
      // girl is missing at t2 -> padded with null
    ],
    ['gender'],
    ['sum__num'],
  );
  expect(Object.keys(data)).toEqual(['sum__num']);
  expect(data.sum__num).toEqual([
    {
      group: ['boy'],
      values: [
        { x: t1, y: 10 },
        { x: t2, y: 20 },
      ],
    },
    {
      group: ['girl'],
      values: [
        { x: t1, y: 30 },
        { x: t2, y: null },
      ],
    },
  ]);
});

test('uses the All group when no groupby is set', () => {
  const data = transformData(
    [
      { __timestamp: t1, sum__num: 1 },
      { __timestamp: t2, sum__num: 2 },
    ],
    [],
    ['sum__num'],
  );
  expect(data.sum__num).toEqual([
    {
      group: 'All',
      values: [
        { x: t1, y: 1 },
        { x: t2, y: 2 },
      ],
    },
  ]);
});

test('handles multiple metrics and multi-column groups', () => {
  const data = transformData(
    [
      { __timestamp: t1, gender: 'boy', state: 'CA', sum__num: 1, count: 5 },
      { __timestamp: t1, gender: 'girl', state: 'NY', sum__num: 2, count: 6 },
    ],
    ['gender', 'state'],
    ['sum__num', 'count'],
  );
  expect(Object.keys(data).sort()).toEqual(['count', 'sum__num']);
  expect(data.count).toEqual([
    { group: ['boy', 'CA'], values: [{ x: t1, y: 5 }] },
    { group: ['girl', 'NY'], values: [{ x: t1, y: 6 }] },
  ]);
});

test('sorts timestamps ascending like the pandas pivot index', () => {
  const data = transformData(
    [
      { __timestamp: t2, sum__num: 2 },
      { __timestamp: t1, sum__num: 1 },
    ],
    [],
    ['sum__num'],
  );
  expect(data.sum__num[0].values.map(v => v.x)).toEqual([t1, t2]);
});

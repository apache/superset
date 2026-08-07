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

const base = {
  groupbyLabels: ['gender', 'state'],
  metricLabels: ['sum__num'],
};

const records = [
  { __timestamp: t1, gender: 'boy', state: 'CA', sum__num: 10 },
  { __timestamp: t1, gender: 'boy', state: 'NY', sum__num: 20 },
  { __timestamp: t1, gender: 'girl', state: 'CA', sum__num: 30 },
  { __timestamp: t2, gender: 'boy', state: 'CA', sum__num: 40 },
];

test('builds the summed hierarchy for the not-time option', () => {
  const data = transformData(records, {
    ...base,
    timeSeriesOption: 'not_time',
  });
  expect(data).toHaveLength(1);
  const root = data[0];
  expect(root.name).toEqual('sum__num');
  expect(root.val).toEqual(100);
  expect(root.children.map(child => [child.name, child.val])).toEqual([
    ['boy', 70],
    ['girl', 30],
  ]);
  // deeper levels carry the dim path in the name
  expect(
    root.children[0].children.map(child => [child.name, child.val]),
  ).toEqual([
    [['boy', 'CA'], 50],
    [['boy', 'NY'], 20],
  ]);
});

test('averages instead of sums for agg_mean', () => {
  const data = transformData(records, {
    ...base,
    timeSeriesOption: 'agg_mean',
  });
  expect(data[0].val).toEqual(25);
  expect(data[0].children[0].val).toBeCloseTo(70 / 3);
});

test('compares the last period against the first for point_diff', () => {
  const data = transformData(records, {
    ...base,
    timeSeriesOption: 'point_diff',
  });
  // until = t2 (40), since = t1 (60)
  expect(data[0].val).toEqual(40 - 60);
  const boy = data[0].children.find(child => child.name === 'boy')!;
  expect(boy.val).toEqual(40 - 30);
  // girl has no rows at t2 -> treated as 0
  const girl = data[0].children.find(child => child.name === 'girl')!;
  expect(girl.val).toEqual(0 - 30);
});

test('uses the timestamp as the first level for time_series', () => {
  const data = transformData(records, {
    ...base,
    timeSeriesOption: 'time_series',
  });
  expect(data[0].children.map(child => child.name)).toEqual([t1, t2]);
  expect(data[0].children[0].val).toEqual(60);
  expect(
    data[0].children[0].children.map(child => [child.name, child.val]),
  ).toEqual([
    [[t1, 'boy'], 30],
    [[t1, 'girl'], 30],
  ]);
});

test('nests metric -> time -> groups for period analysis', () => {
  const data = transformData(records, {
    ...base,
    timeSeriesOption: 'adv_anal',
  });
  expect(data[0].name).toEqual('sum__num');
  expect(data[0].val).toBeUndefined();
  expect(data[0].children.map(child => [child.name, child.val])).toEqual([
    [t1, 60],
    [t2, 40],
  ]);
  const firstTime = data[0].children[0];
  expect(firstTime.children.map(child => [child.name, child.val])).toEqual([
    ['boy', 30],
    ['girl', 30],
  ]);
  // missing combinations are pivot-filled with 0
  const secondTime = data[0].children[1];
  expect(secondTime.children.map(child => [child.name, child.val])).toEqual([
    ['boy', 40],
    ['girl', 0],
  ]);
});

test('applies cumulative sums in period analysis', () => {
  const data = transformData(records, {
    ...base,
    timeSeriesOption: 'adv_anal',
    rollingType: 'cumsum',
  });
  expect(data[0].children.map(child => child.val)).toEqual([60, 100]);
});

test('normalizes each period when contribution is on', () => {
  const data = transformData(records, {
    ...base,
    groupbyLabels: ['gender'],
    timeSeriesOption: 'adv_anal',
    contribution: true,
  });
  const firstTime = data[0].children[0];
  expect(firstTime.children.map(child => child.val)).toEqual([0.5, 0.5]);
});

test('returns an empty hierarchy for empty results', () => {
  expect(
    transformData([], { ...base, timeSeriesOption: 'point_diff' }),
  ).toEqual([]);
});

test('requires at least one groupby', () => {
  expect(() => transformData(records, { ...base, groupbyLabels: [] })).toThrow(
    'groupby',
  );
});

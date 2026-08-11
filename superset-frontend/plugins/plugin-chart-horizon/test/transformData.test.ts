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

test('builds one series per group, dropping the single metric from the key', () => {
  const data = transformData(
    [
      { __timestamp: t1, gender: 'boy', sum__num: 10 },
      { __timestamp: t2, gender: 'boy', sum__num: 20 },
      { __timestamp: t1, gender: 'girl', sum__num: 30 },
    ],
    ['gender'],
    ['sum__num'],
  );
  expect(data).toEqual([
    {
      key: ['boy'],
      values: [
        { x: t1, y: 10 },
        { x: t2, y: 20 },
      ],
    },
    {
      key: ['girl'],
      values: [
        { x: t1, y: 30 },
        { x: t2, y: null },
      ],
    },
  ]);
});

test('keys ungrouped series by the metric name', () => {
  const data = transformData(
    [
      { __timestamp: t1, sum__num: 1, count: 2 },
      { __timestamp: t2, sum__num: 3, count: 4 },
    ],
    [],
    ['sum__num', 'count'],
  );
  expect(data.map(series => series.key)).toEqual(['count', 'sum__num']);
});

test('keeps the metric in multi-metric grouped keys', () => {
  const data = transformData(
    [{ __timestamp: t1, gender: 'boy', sum__num: 1, count: 2 }],
    ['gender'],
    ['sum__num', 'count'],
  );
  expect(data.map(series => series.key)).toEqual([
    ['count', 'boy'],
    ['sum__num', 'boy'],
  ]);
});

test('normalizes rows when contribution is on', () => {
  const data = transformData(
    [
      { __timestamp: t1, gender: 'boy', sum__num: 30 },
      { __timestamp: t1, gender: 'girl', sum__num: 10 },
    ],
    ['gender'],
    ['sum__num'],
    true,
  );
  expect(data[0].values[0].y).toBeCloseTo(0.75);
  expect(data[1].values[0].y).toBeCloseTo(0.25);
});

test('drops series whose values are all null', () => {
  const data = transformData(
    [
      { __timestamp: t1, gender: 'boy', sum__num: 5 },
      { __timestamp: t1, gender: 'girl', sum__num: null },
    ],
    ['gender'],
    ['sum__num'],
  );
  expect(data.map(series => series.key)).toEqual([['boy']]);
});

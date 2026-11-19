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
import transformData, {
  seriesKeyOf,
  splitFlatLabel,
} from '../../src/Rose/transformData';

const t1 = 1704067200000;
const t2 = 1704153600000;

test('re-keys flattened pivot records by timestamp with NaN as 0', () => {
  const data = transformData(
    [
      { __timestamp: t1, 'sum__num, boy': 10, 'sum__num, girl': 20 },
      { __timestamp: t2, 'sum__num, boy': 30, 'sum__num, girl': null },
    ],
    { metricLabels: ['sum__num'], timeCompare: [] },
  );
  expect(data[String(t1)]).toEqual([
    { key: ['boy'], value: 10, name: ['boy'], time: t1 },
    { key: ['girl'], value: 20, name: ['girl'], time: t1 },
  ]);
  expect(data[String(t2)][1]).toEqual({
    key: ['girl'],
    value: 0,
    name: ['girl'],
    time: t2,
  });
});

test('keys ungrouped series by the metric name', () => {
  const data = transformData([{ __timestamp: t1, sum__num: 5 }], {
    metricLabels: ['sum__num'],
    timeCompare: [],
  });
  expect(data[String(t1)]).toEqual([
    { key: 'sum__num', value: 5, name: 'sum__num', time: t1 },
  ]);
});

test('splits flattened labels honoring escaped commas', () => {
  expect(splitFlatLabel('sum__num, CA\\, USA')).toEqual([
    'sum__num',
    'CA, USA',
  ]);
});

test('labels time-shifted columns with the legacy offset suffix', () => {
  expect(
    seriesKeyOf(['sum__num__1 week ago', 'boy'], {
      metricLabels: ['sum__num'],
      timeCompare: ['1 week ago'],
    }),
  ).toEqual(['boy', '1 week ago offset']);
  expect(
    seriesKeyOf(['sum__num__1 week ago'], {
      metricLabels: ['sum__num'],
      timeCompare: ['1 week ago'],
    }),
  ).toEqual(['sum__num', '1 week ago offset']);
});

test('maps comparison columns and drops originals', () => {
  const options = {
    metricLabels: ['sum__num'],
    timeCompare: ['1 week ago'],
    comparisonType: 'difference',
  };
  expect(
    seriesKeyOf(['difference__sum__num__sum__num__1 week ago', 'boy'], options),
  ).toEqual(['boy', '1 week ago offset']);
  expect(seriesKeyOf(['sum__num', 'boy'], options)).toBeNull();
});

test('keeps the metric in multi-metric grouped keys', () => {
  expect(
    seriesKeyOf(['count', 'boy'], {
      metricLabels: ['count', 'sum__num'],
      timeCompare: [],
    }),
  ).toEqual(['count', 'boy']);
});

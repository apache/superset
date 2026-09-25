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
import { supersetTheme } from '@apache-superset/core/theme';
import { ChartProps } from '@superset-ui/core';
import transformProps from '../src/transformProps';

const baseFormData = {
  colorScheme: 'supersetColors',
  groupby: ['gender', 'state'],
  metrics: ['sum__num'],
  timeSeriesOption: 'not_time',
  numberFormat: 'SMART_NUMBER',
  sliceId: 1,
};

function buildChartProps(overrides: Record<string, unknown> = {}) {
  return new ChartProps({
    width: 400,
    height: 300,
    theme: supersetTheme,
    formData: { ...baseFormData, ...overrides },
    datasource: { verboseMap: { gender: 'Gender', state: 'State' } },
    queriesData: [
      {
        data: [
          { gender: 'boy', state: 'CA', sum__num: 10 },
          { gender: 'girl', state: 'NY', sum__num: 20 },
        ],
      },
    ],
  }) as ChartProps;
}

test('builds the hierarchy from v1 flat records and maps levels through verboseMap', () => {
  const result = transformProps(buildChartProps());
  expect(result.width).toEqual(400);
  expect(result.height).toEqual(300);
  expect(result.levels).toEqual(['Gender', 'State']);
  expect(result.data).toHaveLength(1);
  expect(result.data[0].val).toEqual(30);
});

test('falls back to the raw column name when verboseMap has no entry', () => {
  const result = transformProps(
    buildChartProps({ groupby: ['gender', 'unmapped_col'] }),
  );
  expect(result.levels).toEqual(['Gender', 'unmapped_col']);
});

test('parses partitionLimit and partitionThreshold as integers', () => {
  const result = transformProps(
    buildChartProps({ partitionLimit: '5', partitionThreshold: '0.1' }),
  );
  expect(result.partitionLimit).toEqual(5);
  expect(result.partitionThreshold).toEqual(0);
});

test('leaves partitionLimit and partitionThreshold undefined when unset', () => {
  const result = transformProps(buildChartProps());
  expect(result.partitionLimit).toBeFalsy();
  expect(result.partitionThreshold).toBeFalsy();
});

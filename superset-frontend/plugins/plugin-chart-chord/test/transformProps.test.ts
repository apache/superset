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

const baseChartProps = {
  width: 800,
  height: 600,
  datasource: {},
  theme: supersetTheme,
  hooks: {},
};

const formData = {
  groupby: 'source_col',
  columns: 'target_col',
  metric: 'sum__value',
  yAxisFormat: '.2f',
  colorScheme: 'd3Category10',
  sliceId: 1,
};

test('builds the chord node list and matrix from v1 records', () => {
  const chartProps = new ChartProps({
    ...baseChartProps,
    formData,
    queriesData: [
      {
        data: [
          { source_col: 'a', target_col: 'b', sum__value: 10 },
          { source_col: 'b', target_col: 'a', sum__value: 5 },
          { source_col: 'a', target_col: 'c', sum__value: 2 },
        ],
      },
    ],
  });
  const { data } = transformProps(chartProps) as {
    data: { nodes: string[]; matrix: number[][] };
  };
  expect(data.nodes).toEqual(['a', 'b', 'c']);
  // matrix[targetIndex][sourceIndex], matching the legacy backend layout
  expect(data.matrix).toEqual([
    [0, 5, 0], // into a: from a, b, c
    [10, 0, 0], // into b
    [2, 0, 0], // into c
  ]);
});

test('keeps the last value for duplicate source/target pairs', () => {
  const chartProps = new ChartProps({
    ...baseChartProps,
    formData,
    queriesData: [
      {
        data: [
          { source_col: 'a', target_col: 'b', sum__value: 1 },
          { source_col: 'a', target_col: 'b', sum__value: 9 },
        ],
      },
    ],
  });
  const { data } = transformProps(chartProps) as {
    data: { nodes: string[]; matrix: number[][] };
  };
  expect(data.matrix[1][0]).toEqual(9);
});

test('passes through legacy pre-shaped payloads', () => {
  const legacyPayload = { nodes: ['a'], matrix: [[0]] };
  const chartProps = new ChartProps({
    ...baseChartProps,
    formData,
    queriesData: [{ data: legacyPayload }],
  });
  const { data } = transformProps(chartProps) as { data: unknown };
  expect(data).toEqual(legacyPayload);
});

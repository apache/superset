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
import { ChartProps } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import { EchartsSunburstChartProps } from '../../src/Sunburst/types';
import transformProps from '../../src/Sunburst/transformProps';

const formData = {
  colorScheme: 'bnbColors',
  datasource: '3__table',
  groupby: ['category'],
  metric: 'sum__value',
};

const chartProps = new ChartProps({
  formData,
  width: 800,
  height: 600,
  queriesData: [
    {
      data: [
        { category: 'A', sum__value: 10 },
        { category: 'B', sum__value: 20 },
      ],
    },
  ],
  theme: supersetTheme,
});

test('series label has no textBorderColor or textBorderWidth', () => {
  const { echartOptions } = transformProps(
    chartProps as EchartsSunburstChartProps,
  );
  const series = (echartOptions as any).series[0];
  expect(series.label).not.toHaveProperty('textBorderColor');
  expect(series.label).not.toHaveProperty('textBorderWidth');
});

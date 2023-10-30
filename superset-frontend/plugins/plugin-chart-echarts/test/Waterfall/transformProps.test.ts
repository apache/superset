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
import { ChartProps, supersetTheme } from '@superset-ui/core';
import { EchartsWaterfallChartProps } from '../../src/Waterfall/types';
import transformProps from '../../src/Waterfall/transformProps';

describe('Waterfall tranformProps', () => {
  const data = [
    { foo: 'Sylvester', bar: '2019', sum: 10 },
    { foo: 'Arnold', bar: '2019', sum: 3 },
    { foo: 'Sylvester', bar: '2020', sum: -10 },
    { foo: 'Arnold', bar: '2020', sum: 5 },
  ];

  it('should tranform chart props for viz when breakdown not exist', () => {
    const formData1 = {
      colorScheme: 'bnbColors',
      datasource: '3__table',
      granularity_sqla: 'ds',
      metric: 'sum',
      series: 'bar',
    };
    const chartProps = new ChartProps({
      formData: formData1,
      width: 800,
      height: 600,
      queriesData: [
        {
          data,
        },
      ],
      theme: supersetTheme,
    });
    expect(
      transformProps(chartProps as unknown as EchartsWaterfallChartProps),
    ).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          series: [
            expect.objectContaining({
              data: [0, 8, '-'],
            }),
            expect.objectContaining({
              data: [13, '-', '-'],
            }),
            expect.objectContaining({
              data: ['-', 5, '-'],
            }),
            expect.objectContaining({
              data: ['-', '-', 8],
            }),
          ],
        }),
      }),
    );
  });

  it('should tranform chart props for viz when breakdown exist', () => {
    const formData1 = {
      colorScheme: 'bnbColors',
      datasource: '3__table',
      granularity_sqla: 'ds',
      metric: 'sum',
      series: 'bar',
      columns: 'foo',
    };
    const chartProps = new ChartProps({
      formData: formData1,
      width: 800,
      height: 600,
      queriesData: [
        {
          data,
        },
      ],
      theme: supersetTheme,
    });
    expect(
      transformProps(chartProps as unknown as EchartsWaterfallChartProps),
    ).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          series: [
            expect.objectContaining({
              data: [0, 10, '-', 3, 3, '-'],
            }),
            expect.objectContaining({
              data: [10, 3, '-', '-', 5, '-'],
            }),
            expect.objectContaining({
              data: ['-', '-', '-', 10, '-', '-'],
            }),
            expect.objectContaining({
              data: ['-', '-', 13, '-', '-', 8],
            }),
          ],
        }),
      }),
    );
  });
});

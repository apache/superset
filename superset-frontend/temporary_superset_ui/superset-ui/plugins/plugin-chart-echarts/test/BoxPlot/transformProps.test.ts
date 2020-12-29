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
import transformProps from '../../src/BoxPlot/transformProps';

describe('BoxPlot tranformProps', () => {
  const formData = {
    datasource: '5__table',
    granularity_sqla: 'ds',
    time_grain_sqla: 'P1Y',
    columns: [],
    metrics: ['AVG(averageprice)'],
    groupby: ['type', 'region'],
    whiskerOptions: 'Tukey',
    yAxisFormat: 'SMART_NUMBER',
    viz_type: 'my_chart',
  };
  const chartProps = new ChartProps({
    formData,
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [
          {
            type: 'organic',
            region: 'Charlotte',
            'AVG(averageprice)__mean': 1.9405512820512825,
            'AVG(averageprice)__median': 1.9025,
            'AVG(averageprice)__max': 2.505,
            'AVG(averageprice)__min': 1.4775,
            'AVG(averageprice)__q1': 1.73875,
            'AVG(averageprice)__q3': 2.105,
            'AVG(averageprice)__count': 39,
            'AVG(averageprice)__outliers': [2.735],
          },
          {
            type: 'organic',
            region: 'Hartford Springfield',
            'AVG(averageprice)__mean': 2.231141025641026,
            'AVG(averageprice)__median': 2.265,
            'AVG(averageprice)__max': 2.595,
            'AVG(averageprice)__min': 1.862,
            'AVG(averageprice)__q1': 2.1285,
            'AVG(averageprice)__q3': 2.32625,
            'AVG(averageprice)__count': 39,
            'AVG(averageprice)__outliers': [],
          },
        ],
      },
    ],
  });

  it('should tranform chart props for viz', () => {
    expect(transformProps(chartProps)).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          series: expect.arrayContaining([
            expect.objectContaining({
              name: 'boxplot',
              data: expect.arrayContaining([
                expect.objectContaining({
                  name: 'organic, Charlotte',
                  value: [1.4775, 1.73875, 1.9025, 2.105, 2.505, 1.9405512820512825, 39, [2.735]],
                }),
                expect.objectContaining({
                  name: 'organic, Hartford Springfield',
                  value: [1.862, 2.1285, 2.265, 2.32625, 2.595, 2.231141025641026, 39, []],
                }),
              ]),
            }),
            expect.objectContaining({
              name: 'outlier',
              data: [['organic, Charlotte', 2.735]],
            }),
          ]),
        }),
      }),
    );
  });
});

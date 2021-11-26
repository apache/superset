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
import 'babel-polyfill';
import { ChartProps } from '@superset-ui/core';
import transformProps from '../../src/Timeseries/transformProps';

describe('EchartsTimeseries tranformProps', () => {
  const formData = {
    colorScheme: 'bnbColors',
    datasource: '3__table',
    granularity_sqla: 'ds',
    metric: 'sum__num',
    series: ['foo', 'bar'],
  };
  const chartProps = new ChartProps({
    formData,
    width: 800,
    height: 600,
    queryData: {
      data: [
        { 'San Francisco': 1, 'New York': 2, __timestamp: 599616000000 },
        { 'San Francisco': 3, 'New York': 4, __timestamp: 599916000000 },
      ],
    },
  });

  it('should tranform chart props for viz', () => {
    expect(transformProps(chartProps)).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          legend: expect.objectContaining({
            data: ['San Francisco', 'New York'],
          }),
          series: expect.arrayContaining([
            expect.objectContaining({
              data: [
                [new Date(599616000000), 1],
                [new Date(599916000000), 3],
              ],
              name: 'San Francisco',
            }),
            expect.objectContaining({
              data: [
                [new Date(599616000000), 2],
                [new Date(599916000000), 4],
              ],
              name: 'New York',
            }),
          ]),
        }),
      }),
    );
  });
});

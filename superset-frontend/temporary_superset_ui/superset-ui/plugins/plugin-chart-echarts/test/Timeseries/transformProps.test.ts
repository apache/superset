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
import {
  ChartProps,
  EventAnnotationLayer,
  FormulaAnnotationLayer,
  IntervalAnnotationLayer,
  TimeseriesAnnotationLayer,
} from '@superset-ui/core';
import transformProps from '../../src/Timeseries/transformProps';

describe('EchartsTimeseries tranformProps', () => {
  const formData = {
    colorScheme: 'bnbColors',
    datasource: '3__table',
    granularity_sqla: 'ds',
    metric: 'sum__num',
    groupby: ['foo', 'bar'],
  };
  const queriesData = [
    {
      data: [
        { 'San Francisco': 1, 'New York': 2, __timestamp: 599616000000 },
        { 'San Francisco': 3, 'New York': 4, __timestamp: 599916000000 },
      ],
    },
  ];
  const chartPropsConfig = {
    formData,
    width: 800,
    height: 600,
    queriesData,
  };

  it('should tranform chart props for viz', () => {
    const chartProps = new ChartProps(chartPropsConfig);
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

  it('should add a formula annotation to viz', () => {
    const formula: FormulaAnnotationLayer = {
      name: 'My Formula',
      annotationType: 'FORMULA',
      value: 'x+1',
      style: 'solid',
      show: true,
    };
    const chartProps = new ChartProps({
      ...chartPropsConfig,
      formData: {
        ...formData,
        annotationLayers: [formula],
      },
    });
    expect(transformProps(chartProps)).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          legend: expect.objectContaining({
            data: ['San Francisco', 'New York', 'My Formula'],
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
            expect.objectContaining({
              data: [
                [new Date(599616000000), 599616000001],
                [new Date(599916000000), 599916000001],
              ],
              name: 'My Formula',
            }),
          ]),
        }),
      }),
    );
  });

  it('should add an interval, event and timeseries annotation to viz', () => {
    const event: EventAnnotationLayer = {
      annotationType: 'EVENT',
      name: 'My Event',
      show: true,
      sourceType: 'NATIVE',
      style: 'solid',
      value: 1,
    };

    const interval: IntervalAnnotationLayer = {
      annotationType: 'INTERVAL',
      name: 'My Interval',
      show: true,
      sourceType: 'table',
      titleColumn: '',
      timeColumn: 'start',
      intervalEndColumn: '',
      descriptionColumns: [],
      style: 'dashed',
      value: 2,
    };

    const timeseries: TimeseriesAnnotationLayer = {
      annotationType: 'TIME_SERIES',
      name: 'My Timeseries',
      show: true,
      sourceType: 'line',
      style: 'solid',
      titleColumn: '',
      value: 3,
    };
    const chartProps = new ChartProps({
      ...chartPropsConfig,
      formData: {
        ...formData,
        annotationLayers: [event, interval, timeseries],
      },
      queriesData: [
        {
          ...queriesData[0],
          annotation_data: {
            'My Event': {
              columns: ['start_dttm', 'end_dttm', 'short_descr', 'long_descr', 'json_metadata'],
              records: [
                {
                  start_dttm: 0,
                  end_dttm: 1000,
                  short_descr: '',
                  long_descr: '',
                  json_metadata: null,
                },
              ],
            },
            'My Interval': {
              columns: ['start', 'end', 'title'],
              records: [
                {
                  start: 2000,
                  end: 3000,
                  title: 'My Title',
                },
              ],
            },
            'My Timeseries': [
              {
                key: 'My Line',
                values: [
                  {
                    x: 10000,
                    y: 11000,
                  },
                  {
                    x: 20000,
                    y: 21000,
                  },
                ],
              },
            ],
          },
        },
      ],
    });
    expect(transformProps(chartProps)).toEqual(
      expect.objectContaining({
        echartOptions: expect.objectContaining({
          legend: expect.objectContaining({
            data: ['San Francisco', 'New York', 'My Line'],
          }),
          series: expect.arrayContaining([
            expect.objectContaining({
              type: 'line',
              id: 'My Line',
            }),
            expect.objectContaining({
              type: 'line',
              id: 'Event - My Event',
            }),
            expect.objectContaining({
              type: 'line',
              id: 'Interval - My Interval',
            }),
          ]),
        }),
      }),
    );
  });
});

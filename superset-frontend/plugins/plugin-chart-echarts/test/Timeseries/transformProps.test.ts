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
  AnnotationSourceType,
  AnnotationStyle,
  AnnotationType,
  ChartProps,
  EventAnnotationLayer,
  FormulaAnnotationLayer,
  IntervalAnnotationLayer,
  SqlaFormData,
  supersetTheme,
  TimeseriesAnnotationLayer,
} from '@superset-ui/core';
import { EchartsTimeseriesChartProps } from '../../src/types';
import transformProps from '../../src/Timeseries/transformProps';

describe('EchartsTimeseries transformProps', () => {
  const formData: SqlaFormData = {
    colorScheme: 'bnbColors',
    datasource: '3__table',
    granularity_sqla: 'ds',
    metric: 'sum__num',
    groupby: ['foo', 'bar'],
    viz_type: 'my_viz',
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
    theme: supersetTheme,
  };

  it('should transform chart props for viz', () => {
    const chartProps = new ChartProps(chartPropsConfig);
    expect(transformProps(chartProps as EchartsTimeseriesChartProps)).toEqual(
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
                [599616000000, 1],
                [599916000000, 3],
              ],
              name: 'San Francisco',
            }),
            expect.objectContaining({
              data: [
                [599616000000, 2],
                [599916000000, 4],
              ],
              name: 'New York',
            }),
          ]),
        }),
      }),
    );
  });

  it('should transform chart props for horizontal viz', () => {
    const chartProps = new ChartProps({
      ...chartPropsConfig,
      formData: {
        ...formData,
        orientation: 'horizontal',
      },
    });
    expect(transformProps(chartProps as EchartsTimeseriesChartProps)).toEqual(
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
                [1, 599616000000],
                [3, 599916000000],
              ],
              name: 'San Francisco',
            }),
            expect.objectContaining({
              data: [
                [2, 599616000000],
                [4, 599916000000],
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
      annotationType: AnnotationType.Formula,
      value: 'x+1',
      style: AnnotationStyle.Solid,
      show: true,
      showLabel: true,
    };
    const chartProps = new ChartProps({
      ...chartPropsConfig,
      formData: {
        ...formData,
        annotationLayers: [formula],
      },
    });
    expect(transformProps(chartProps as EchartsTimeseriesChartProps)).toEqual(
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
                [599616000000, 1],
                [599916000000, 3],
              ],
              name: 'San Francisco',
            }),
            expect.objectContaining({
              data: [
                [599616000000, 2],
                [599916000000, 4],
              ],
              name: 'New York',
            }),
            expect.objectContaining({
              data: [
                [599616000000, 599616000001],
                [599916000000, 599916000001],
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
      annotationType: AnnotationType.Event,
      name: 'My Event',
      show: true,
      showLabel: true,
      sourceType: AnnotationSourceType.Native,
      style: AnnotationStyle.Solid,
      value: 1,
    };

    const interval: IntervalAnnotationLayer = {
      annotationType: AnnotationType.Interval,
      name: 'My Interval',
      show: true,
      showLabel: true,
      sourceType: AnnotationSourceType.Table,
      titleColumn: '',
      timeColumn: 'start',
      intervalEndColumn: '',
      descriptionColumns: [],
      style: AnnotationStyle.Dashed,
      value: 2,
    };

    const timeseries: TimeseriesAnnotationLayer = {
      annotationType: AnnotationType.Timeseries,
      name: 'My Timeseries',
      show: true,
      showLabel: true,
      sourceType: AnnotationSourceType.Line,
      style: AnnotationStyle.Solid,
      titleColumn: '',
      value: 3,
    };
    const annotationData = {
      'My Event': {
        columns: [
          'start_dttm',
          'end_dttm',
          'short_descr',
          'long_descr',
          'json_metadata',
        ],
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
    };
    const chartProps = new ChartProps({
      ...chartPropsConfig,
      formData: {
        ...formData,
        annotationLayers: [event, interval, timeseries],
      },
      annotationData,
      queriesData: [
        {
          ...queriesData[0],
          annotation_data: annotationData,
        },
      ],
    });
    expect(transformProps(chartProps as EchartsTimeseriesChartProps)).toEqual(
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

  it('Should add a baseline series for stream graph', () => {
    const streamQueriesData = [
      {
        data: [
          {
            'San Francisco': 120,
            'New York': 220,
            Boston: 150,
            Miami: 270,
            Denver: 800,
            __timestamp: 599616000000,
          },
          {
            'San Francisco': 150,
            'New York': 190,
            Boston: 240,
            Miami: 350,
            Denver: 700,
            __timestamp: 599616000001,
          },
          {
            'San Francisco': 130,
            'New York': 300,
            Boston: 250,
            Miami: 410,
            Denver: 650,
            __timestamp: 599616000002,
          },
          {
            'San Francisco': 90,
            'New York': 340,
            Boston: 300,
            Miami: 480,
            Denver: 590,
            __timestamp: 599616000003,
          },
          {
            'San Francisco': 260,
            'New York': 200,
            Boston: 420,
            Miami: 490,
            Denver: 760,
            __timestamp: 599616000004,
          },
          {
            'San Francisco': 250,
            'New York': 250,
            Boston: 380,
            Miami: 360,
            Denver: 400,
            __timestamp: 599616000005,
          },
          {
            'San Francisco': 160,
            'New York': 210,
            Boston: 330,
            Miami: 440,
            Denver: 580,
            __timestamp: 599616000006,
          },
        ],
      },
    ];
    const streamFormData = { ...formData, stack: 'Stream' };
    const props = {
      ...chartPropsConfig,
      formData: streamFormData,
      queriesData: streamQueriesData,
    };

    const chartProps = new ChartProps(props);
    expect(
      (
        transformProps(chartProps as EchartsTimeseriesChartProps).echartOptions
          .series as any[]
      )[0],
    ).toEqual({
      areaStyle: {
        opacity: 0,
      },
      lineStyle: {
        opacity: 0,
      },
      name: 'baseline',
      showSymbol: false,
      silent: true,
      smooth: false,
      stack: 'obs',
      stackStrategy: 'all',
      step: undefined,
      tooltip: {
        show: false,
      },
      type: 'line',
      data: [
        [599616000000, -415.7692307692308],
        [599616000001, -403.6219915054271],
        [599616000002, -476.32314093071443],
        [599616000003, -514.2120298196033],
        [599616000004, -485.7378514158475],
        [599616000005, -419.6402904402378],
        [599616000006, -442.9833136960517],
      ],
    });
  });
});

describe('Does transformProps transform series correctly', () => {
  type seriesDataType = [Date, number];
  type labelFormatterType = (params: {
    value: seriesDataType;
    dataIndex: number;
    seriesIndex: number;
  }) => string;
  type seriesType = {
    label: { show: boolean; formatter: labelFormatterType };
    data: seriesDataType[];
    name: string;
  };

  const formData: SqlaFormData = {
    viz_type: 'my_viz',
    colorScheme: 'bnbColors',
    datasource: '3__table',
    granularity_sqla: 'ds',
    metric: 'sum__num',
    groupby: ['foo', 'bar'],
    showValue: true,
    stack: true,
    onlyTotal: false,
    percentageThreshold: 50,
  };
  const queriesData = [
    {
      data: [
        {
          'San Francisco': 1,
          'New York': 2,
          Boston: 1,
          __timestamp: 599616000000,
        },
        {
          'San Francisco': 3,
          'New York': 4,
          Boston: 1,
          __timestamp: 599916000000,
        },
        {
          'San Francisco': 5,
          'New York': 8,
          Boston: 6,
          __timestamp: 600216000000,
        },
        {
          'San Francisco': 2,
          'New York': 7,
          Boston: 2,
          __timestamp: 600516000000,
        },
      ],
    },
  ];
  const chartPropsConfig = {
    formData,
    width: 800,
    height: 600,
    queriesData,
    theme: supersetTheme,
  };

  const totalStackedValues = queriesData[0].data.reduce(
    (totals, currentStack) => {
      const total = Object.keys(currentStack).reduce((stackSum, key) => {
        if (key === '__timestamp') return stackSum;
        return stackSum + currentStack[key];
      }, 0);
      totals.push(total);
      return totals;
    },
    [] as number[],
  );

  it('should show labels when showValue is true', () => {
    const chartProps = new ChartProps(chartPropsConfig);

    const transformedSeries = transformProps(
      chartProps as EchartsTimeseriesChartProps,
    ).echartOptions.series as seriesType[];

    transformedSeries.forEach(series => {
      expect(series.label.show).toBe(true);
    });
  });

  it('should not show labels when showValue is false', () => {
    const updatedChartPropsConfig = {
      ...chartPropsConfig,
      formData: { ...formData, showValue: false },
    };

    const chartProps = new ChartProps(updatedChartPropsConfig);

    const transformedSeries = transformProps(
      chartProps as EchartsTimeseriesChartProps,
    ).echartOptions.series as seriesType[];

    transformedSeries.forEach(series => {
      expect(series.label.show).toBe(false);
    });
  });

  it('should show only totals when onlyTotal is true', () => {
    const updatedChartPropsConfig = {
      ...chartPropsConfig,
      formData: { ...formData, onlyTotal: true },
    };

    const chartProps = new ChartProps(updatedChartPropsConfig);

    const transformedSeries = transformProps(
      chartProps as EchartsTimeseriesChartProps,
    ).echartOptions.series as seriesType[];

    const showValueIndexes: number[] = [];

    transformedSeries.forEach((entry, seriesIndex) => {
      const { data = [] } = entry;
      (data as [Date, number][]).forEach((datum, dataIndex) => {
        if (datum[1] !== null) {
          showValueIndexes[dataIndex] = seriesIndex;
        }
      });
    });

    transformedSeries.forEach((series, seriesIndex) => {
      expect(series.label.show).toBe(true);
      series.data.forEach((value, dataIndex) => {
        const params = {
          value,
          dataIndex,
          seriesIndex,
        };

        let expectedLabel: string;

        if (seriesIndex === showValueIndexes[dataIndex]) {
          expectedLabel = String(totalStackedValues[dataIndex]);
        } else {
          expectedLabel = '';
        }

        expect(series.label.formatter(params)).toBe(expectedLabel);
      });
    });
  });

  it('should show labels on values >= percentageThreshold if onlyTotal is false', () => {
    const chartProps = new ChartProps(chartPropsConfig);

    const transformedSeries = transformProps(
      chartProps as EchartsTimeseriesChartProps,
    ).echartOptions.series as seriesType[];

    const expectedThresholds = totalStackedValues.map(
      total => ((formData.percentageThreshold || 0) / 100) * total,
    );

    transformedSeries.forEach((series, seriesIndex) => {
      expect(series.label.show).toBe(true);
      series.data.forEach((value, dataIndex) => {
        const params = {
          value,
          dataIndex,
          seriesIndex,
        };
        const expectedLabel =
          value[1] >= expectedThresholds[dataIndex] ? String(value[1]) : '';
        expect(series.label.formatter(params)).toBe(expectedLabel);
      });
    });
  });

  it('should not apply percentage threshold when showValue is true and stack is false', () => {
    const updatedChartPropsConfig = {
      ...chartPropsConfig,
      formData: { ...formData, stack: false },
    };

    const chartProps = new ChartProps(updatedChartPropsConfig);

    const transformedSeries = transformProps(
      chartProps as EchartsTimeseriesChartProps,
    ).echartOptions.series as seriesType[];

    transformedSeries.forEach((series, seriesIndex) => {
      expect(series.label.show).toBe(true);
      series.data.forEach((value, dataIndex) => {
        const params = {
          value,
          dataIndex,
          seriesIndex,
        };
        const expectedLabel = String(value[1]);
        expect(series.label.formatter(params)).toBe(expectedLabel);
      });
    });
  });

  it('should remove time shift labels from label_map', () => {
    const updatedChartPropsConfig = {
      ...chartPropsConfig,
      formData: {
        ...formData,
        timeCompare: ['1 year ago'],
      },
      queriesData: [
        {
          ...queriesData[0],
          label_map: {
            '1 year ago, foo1, bar1': ['1 year ago', 'foo1', 'bar1'],
            '1 year ago, foo2, bar2': ['1 year ago', 'foo2', 'bar2'],
            'foo1, bar1': ['foo1', 'bar1'],
            'foo2, bar2': ['foo2', 'bar2'],
          },
        },
      ],
    };
    const chartProps = new ChartProps(updatedChartPropsConfig);
    const transformedProps = transformProps(
      chartProps as EchartsTimeseriesChartProps,
    );
    expect(transformedProps.labelMap).toEqual({
      '1 year ago, foo1, bar1': ['foo1', 'bar1'],
      '1 year ago, foo2, bar2': ['foo2', 'bar2'],
      'foo1, bar1': ['foo1', 'bar1'],
      'foo2, bar2': ['foo2', 'bar2'],
    });
  });
});

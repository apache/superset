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
import { AxisType, ChartProps } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import type { LegendComponentOption } from 'echarts/components';
import {
  LegendOrientation,
  LegendType,
} from '@superset-ui/plugin-chart-echarts';
import transformProps from '../../src/Gantt/transformProps';
import {
  EchartsGanttChartProps,
  EchartsGanttFormData,
} from '../../src/Gantt/types';

const formData: EchartsGanttFormData = {
  viz_type: 'gantt_chart',
  datasource: '1__table',

  startTime: 'startTime',
  endTime: 'endTime',
  yAxis: {
    label: 'Y Axis',
    sqlExpression: 'y_axis',
    expressionType: 'SQL',
  },
  tooltipMetrics: ['tooltip_metric'],
  tooltipColumns: ['tooltip_column'],
  series: 'series',
  xAxisTimeFormat: '%H:%M',
  tooltipTimeFormat: '%H:%M',
  tooltipValuesFormat: 'DURATION_SEC',
  colorScheme: 'bnbColors',
  zoomable: true,
  xAxisTitleMargin: undefined,
  yAxisTitleMargin: undefined,
  xAxisTimeBounds: [null, '19:00:00'],
  subcategories: true,
  legendMargin: 0,
  legendOrientation: LegendOrientation.Top,
  legendType: LegendType.Scroll,
  showLegend: true,
  sortSeriesAscending: true,
  legendSort: null,
};
const queriesData = [
  {
    data: [
      {
        startTime: Date.UTC(2025, 1, 1, 13, 0, 0),
        endTime: Date.UTC(2025, 1, 1, 14, 0, 0),
        'Y Axis': 'first',
        tooltip_column: 'tooltip value 1',
        series: 'series value 1',
      },
      {
        startTime: Date.UTC(2025, 1, 1, 18, 0, 0),
        endTime: Date.UTC(2025, 1, 1, 20, 0, 0),
        'Y Axis': 'second',
        tooltip_column: 'tooltip value 2',
        series: 'series value 2',
      },
    ],
    colnames: ['startTime', 'endTime', 'Y Axis', 'tooltip_column', 'series'],
  },
];
const chartPropsConfig = {
  formData,
  queriesData,
  theme: supersetTheme,
};

describe('Gantt transformProps', () => {
  test('should transform chart props', () => {
    const chartProps = new ChartProps(chartPropsConfig);
    const transformedProps = transformProps(
      chartProps as EchartsGanttChartProps,
    );

    expect(transformedProps.echartOptions.series).toHaveLength(4);
    const series = transformedProps.echartOptions.series as any[];
    const series0 = series[0];
    const series1 = series[1];

    // exclude renderItem because it can't be serialized
    expect(typeof series0.renderItem).toBe('function');
    delete series0.renderItem;
    expect(typeof series1.renderItem).toBe('function');
    delete series1.renderItem;
    delete transformedProps.echartOptions.series;

    expect(transformedProps).toEqual(
      expect.objectContaining({
        echartOptions: expect.objectContaining({
          useUTC: true,
          xAxis: {
            name: '',
            nameGap: 0,
            nameLocation: 'middle',
            max: Date.UTC(2025, 1, 1, 19, 0, 0),
            min: undefined,
            type: AxisType.Time,
            axisLabel: {
              hideOverlap: true,
              formatter: expect.anything(),
            },
          },
          yAxis: {
            name: '',
            nameGap: 0,
            nameLocation: 'middle',
            type: AxisType.Value,
            // always 0
            min: 0,
            // equals unique categories count
            max: 2,
            axisLabel: {
              show: false,
            },
            splitLine: {
              show: false,
            },
          },
          legend: expect.objectContaining({
            show: true,
            type: 'scroll',
          }),
          tooltip: {
            formatter: expect.anything(),
          },
          dataZoom: [
            expect.objectContaining({
              type: 'slider',
              filterMode: 'none',
            }),
          ],
        }),
      }),
    );

    expect(series0).toEqual({
      name: 'series value 1',
      type: 'custom',
      progressive: 0,
      itemStyle: {
        color: expect.anything(),
      },
      data: [
        {
          value: [
            Date.UTC(2025, 1, 1, 13, 0, 0),
            Date.UTC(2025, 1, 1, 14, 0, 0),
            0,
            2,
            Date.UTC(2025, 1, 1, 13, 0, 0),
            Date.UTC(2025, 1, 1, 14, 0, 0),
            'first',
            'tooltip value 1',
            'series value 1',
          ],
        },
      ],
      dimensions: [
        'startTime',
        'endTime',
        'index',
        'seriesCount',
        'startTime',
        'endTime',
        'Y Axis',
        'tooltip_column',
        'series',
      ],
      encode: {
        x: [0, 1],
      },
    });

    expect(series1).toEqual({
      name: 'series value 2',
      type: 'custom',
      progressive: 0,
      itemStyle: {
        color: expect.anything(),
      },
      data: [
        {
          value: [
            Date.UTC(2025, 1, 1, 18, 0, 0),
            Date.UTC(2025, 1, 1, 20, 0, 0),
            1,
            2,
            Date.UTC(2025, 1, 1, 18, 0, 0),
            Date.UTC(2025, 1, 1, 20, 0, 0),
            'second',
            'tooltip value 2',
            'series value 2',
          ],
        },
      ],
      dimensions: [
        'startTime',
        'endTime',
        'index',
        'seriesCount',
        'startTime',
        'endTime',
        'Y Axis',
        'tooltip_column',
        'series',
      ],
      encode: {
        x: [0, 1],
      },
    });
    expect(series[2]).toEqual({
      // just for markLines
      type: 'line',
      animation: false,
      markLine: {
        data: [{ yAxis: 1 }, { yAxis: 0 }],
        label: {
          show: false,
        },
        silent: true,
        symbol: ['none', 'none'],
        lineStyle: {
          type: 'dashed',
          color: '#dbe0ea',
        },
      },
    });
    expect(series[3]).toEqual({
      type: 'line',
      animation: false,
      markLine: {
        data: [
          { yAxis: 1.5, name: 'first' },
          { yAxis: 0.5, name: 'second' },
        ],
        label: {
          show: true,
          position: 'start',
          formatter: '{b}',
          color: 'rgba(0,0,0,0.88)',
          fontSize: supersetTheme.fontSizeSM,
          fontFamily: supersetTheme.fontFamily,
        },
        lineStyle: expect.objectContaining({
          color: '#00000000',
          type: 'solid',
        }),
        silent: true,
        symbol: ['none', 'none'],
      },
    });
  });
});

describe('category label width reservation', () => {
  test('reserves the ink extent of the widest label, not just its narrower advance width', () => {
    // Simulates a glyph whose visible ink extends past the metrics.width
    // advance value returned by measureText (e.g. italics or descenders).
    // The grid must grow to fit the ink extent, or the previous
    // "prevent cut off" fix (#39137) regresses back to clipped labels.
    const getContext = jest.spyOn(HTMLCanvasElement.prototype, 'getContext');
    try {
      // "first" always measures narrower than "second" so "second" alone
      // drives maxCategoryLabelWidth in both runs below.
      getContext.mockReturnValue({
        measureText: (text: string) =>
          text === 'second'
            ? {
                width: 10,
                actualBoundingBoxLeft: 0,
                actualBoundingBoxRight: 10,
              }
            : { width: 5, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 5 },
      } as never);
      const withoutOverhang = transformProps(
        new ChartProps(chartPropsConfig) as EchartsGanttChartProps,
      );

      getContext.mockReturnValue({
        measureText: (text: string) =>
          text === 'second'
            ? {
                width: 10,
                actualBoundingBoxLeft: 5,
                actualBoundingBoxRight: 45,
              }
            : { width: 5, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 5 },
      } as never);
      const withOverhang = transformProps(
        new ChartProps(chartPropsConfig) as EchartsGanttChartProps,
      );

      const noOverhangLeft = (
        withoutOverhang.echartOptions.grid as { left: number }
      ).left;
      const overhangLeft = (withOverhang.echartOptions.grid as { left: number })
        .left;

      // Ink extent for "second" is 5 + 45 = 50 vs. its 10px advance width;
      // the reserved space must grow by the full 40px difference.
      expect(overhangLeft - noOverhangLeft).toBe(40);
    } finally {
      getContext.mockRestore();
    }
  });

  test('measures label width using the exact font the label is rendered in', () => {
    let capturedFont = '';
    const getContext = jest.spyOn(HTMLCanvasElement.prototype, 'getContext');
    try {
      getContext.mockReturnValue({
        set font(value: string) {
          capturedFont = value;
        },
        get font() {
          return capturedFont;
        },
        measureText: (text: string) => ({
          width: text.length * 7,
          actualBoundingBoxLeft: 0,
          actualBoundingBoxRight: text.length * 7,
        }),
      } as never);

      const transformed = transformProps(
        new ChartProps(chartPropsConfig) as EchartsGanttChartProps,
      );

      expect(capturedFont).toBe(
        `${supersetTheme.fontSizeSM}px ${supersetTheme.fontFamily}`,
      );

      const categoryLabelSeries = (
        transformed.echartOptions.series as Array<{
          markLine?: {
            label?: {
              show?: boolean;
              fontSize?: number;
              fontFamily?: string;
            };
          };
        }>
      ).find(series => series.markLine?.label?.show);

      // The rendered label must use the same font as the measurement, or the
      // reserved grid space can fall out of sync with the painted text again.
      expect(categoryLabelSeries?.markLine?.label).toMatchObject({
        fontSize: supersetTheme.fontSizeSM,
        fontFamily: supersetTheme.fontFamily,
      });
    } finally {
      getContext.mockRestore();
    }
  });
});

describe('legend sorting', () => {
  const createChartProps = (overrides = {}) =>
    new ChartProps({
      ...chartPropsConfig,
      formData: {
        ...formData,
        ...overrides,
      },
    });

  test('preserves original data order when no sort specified', () => {
    const props = createChartProps({ legendSort: null });
    const result = transformProps(props as EchartsGanttChartProps);

    const legendData = (result.echartOptions.legend as any).data;
    expect(legendData).toEqual(['series value 1', 'series value 2']);
  });

  test('sorts alphabetically ascending when legendSort is "asc"', () => {
    const props = createChartProps({ legendSort: 'asc' });
    const result = transformProps(props as EchartsGanttChartProps);

    const legendData = (result.echartOptions.legend as any).data;
    expect(legendData).toEqual(['series value 1', 'series value 2']);
  });

  test('sorts alphabetically descending when legendSort is "desc"', () => {
    const props = createChartProps({ legendSort: 'desc' });
    const result = transformProps(props as EchartsGanttChartProps);

    const legendData = (result.echartOptions.legend as any).data;
    expect(legendData).toEqual(['series value 2', 'series value 1']);
  });

  test('honors an explicit List selection for plain legends with an overlong legend item', () => {
    const props = new ChartProps({
      ...chartPropsConfig,
      width: 320,
      formData: {
        ...formData,
        legendType: LegendType.Plain,
      },
      queriesData: [
        {
          data: [
            {
              startTime: Date.UTC(2025, 1, 1, 13, 0, 0),
              endTime: Date.UTC(2025, 1, 1, 14, 0, 0),
              'Y Axis': 'first',
              tooltip_column: 'tooltip value 1',
              series:
                'This is a ridiculously long legend label that stays a plain List',
            },
            {
              startTime: Date.UTC(2025, 1, 1, 18, 0, 0),
              endTime: Date.UTC(2025, 1, 1, 20, 0, 0),
              'Y Axis': 'second',
              tooltip_column: 'tooltip value 2',
              series: 'short label',
            },
          ],
          colnames: [
            'startTime',
            'endTime',
            'Y Axis',
            'tooltip_column',
            'series',
          ],
        },
      ],
    });

    const result = transformProps(props as EchartsGanttChartProps);

    expect((result.echartOptions.legend as LegendComponentOption).type).toBe(
      LegendType.Plain,
    );
  });

  test('keeps legend visibility driven by showLegend for single-series charts', () => {
    const props = new ChartProps({
      ...chartPropsConfig,
      queriesData: [
        {
          data: [queriesData[0].data[0]],
          colnames: [
            'startTime',
            'endTime',
            'Y Axis',
            'tooltip_column',
            'series',
          ],
        },
      ],
    });

    const result = transformProps(props as EchartsGanttChartProps);

    expect((result.echartOptions.legend as any).show).toBe(true);
  });
});

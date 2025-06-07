import { AxisType, ChartProps, supersetTheme } from '@superset-ui/core';
import {
  LegendOrientation,
  LegendType,
} from '@superset-ui/plugin-chart-echarts';
import transformProps from '../../src/Timeline/transformProps';
import {
  EchartsTimelineChartProps,
  EchartsTimelineFormData,
} from '../../src/Timeline/types';

describe('Timeline transformProps', () => {
  const formData: EchartsTimelineFormData = {
    viz_type: 'echarts_timeline',
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

  it('should transform chart props', () => {
    const chartProps = new ChartProps(chartPropsConfig);
    const transformedProps = transformProps(
      chartProps as EchartsTimelineChartProps,
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
            max: Date.UTC(2025, 1, 1, 19, 0, 0),
            min: undefined,
            type: AxisType.Time,
            nameGap: 0,
            nameLocation: 'middle',
            axisLabel: {
              hideOverlap: true,
              formatter: expect.anything(),
            },
          },
          yAxis: {
            type: AxisType.Value,
            // always 0
            min: 0,
            // equals unique categories count
            max: 2,
            // always disabled because markLines are used instead
            show: false,
            nameGap: 0,
          },
          legend: expect.objectContaining({
            show: true,
            type: 'scroll',
            selector: ['all', 'inverse'],
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
        'start_time',
        'end_time',
        'index',
        'series_count',
        'startTime',
        'endTime',
        'Y Axis',
        'tooltip_column',
        'series',
      ],
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
        'start_time',
        'end_time',
        'index',
        'series_count',
        'startTime',
        'endTime',
        'Y Axis',
        'tooltip_column',
        'series',
      ],
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

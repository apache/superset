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
  getNumberFormatter,
  SqlaFormData,
  supersetTheme,
} from '@superset-ui/core';
import type { PieSeriesOption } from 'echarts/charts';
import type {
  LabelFormatterCallback,
  CallbackDataParams,
} from 'echarts/types/src/util/types';
import transformProps, { parseParams } from '../../src/Pie/transformProps';
import { EchartsPieChartProps, PieChartDataItem } from '../../src/Pie/types';

describe('Pie transformProps', () => {
  const formData: SqlaFormData = {
    colorScheme: 'bnbColors',
    datasource: '3__table',
    granularity_sqla: 'ds',
    metric: 'sum__num',
    groupby: ['foo', 'bar'],
    viz_type: 'my_viz',
  };
  const chartProps = new ChartProps({
    formData,
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [
          {
            foo: 'Sylvester',
            bar: 1,
            sum__num: 10,
            sum__num__contribution: 0.8,
          },
          { foo: 'Arnold', bar: 2, sum__num: 2.5, sum__num__contribution: 0.2 },
        ],
      },
    ],
    theme: supersetTheme,
  });

  it('should transform chart props for viz', () => {
    expect(transformProps(chartProps as EchartsPieChartProps)).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          series: [
            expect.objectContaining({
              avoidLabelOverlap: true,
              data: expect.arrayContaining([
                expect.objectContaining({
                  name: 'Arnold, 2',
                  value: 2.5,
                }),
                expect.objectContaining({
                  name: 'Sylvester, 1',
                  value: 10,
                }),
              ]),
            }),
          ],
        }),
      }),
    );
  });
});

describe('formatPieLabel', () => {
  it('should generate a valid pie chart label', () => {
    const numberFormatter = getNumberFormatter();
    const params = { name: 'My Label', value: 1234, percent: 12.34 };
    expect(
      parseParams({
        params,
        numberFormatter,
      }),
    ).toEqual(['My Label', '1.23k', '12.34%']);
    expect(
      parseParams({
        params: { ...params, name: '<NULL>' },
        numberFormatter,
      }),
    ).toEqual(['<NULL>', '1.23k', '12.34%']);
    expect(
      parseParams({
        params: { ...params, name: '<NULL>' },
        numberFormatter,
        sanitizeName: true,
      }),
    ).toEqual(['&lt;NULL&gt;', '1.23k', '12.34%']);
  });
});

describe('Pie label string template', () => {
  const params: CallbackDataParams = {
    componentType: '',
    componentSubType: '',
    componentIndex: 0,
    seriesType: 'pie',
    seriesIndex: 0,
    seriesId: 'seriesId',
    seriesName: 'test',
    name: 'Tablet',
    dataIndex: 0,
    data: {},
    value: 123456,
    percent: 55.5,
    $vars: [],
  };

  const getChartProps = (form: Partial<SqlaFormData>): EchartsPieChartProps => {
    const formData: SqlaFormData = {
      colorScheme: 'bnbColors',
      datasource: '3__table',
      granularity_sqla: 'ds',
      metric: 'sum__num',
      groupby: ['foo', 'bar'],
      viz_type: 'my_viz',
      ...form,
    };

    return new ChartProps({
      formData,
      width: 800,
      height: 600,
      queriesData: [
        {
          data: [
            { foo: 'Sylvester', bar: 1, sum__num: 10 },
            { foo: 'Arnold', bar: 2, sum__num: 2.5 },
          ],
        },
      ],
      theme: supersetTheme,
    }) as EchartsPieChartProps;
  };

  const format = (form: Partial<SqlaFormData>) => {
    const props = transformProps(getChartProps(form));
    expect(props).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          series: [
            expect.objectContaining({
              avoidLabelOverlap: true,
              data: expect.arrayContaining([
                expect.objectContaining({
                  name: 'Arnold, 2',
                  value: 2.5,
                }),
                expect.objectContaining({
                  name: 'Sylvester, 1',
                  value: 10,
                }),
              ]),
              label: expect.objectContaining({
                formatter: expect.any(Function),
              }),
            }),
          ],
        }),
      }),
    );

    const formatter = (props.echartOptions.series as PieSeriesOption[])[0]!
      .label?.formatter;

    return (formatter as LabelFormatterCallback)(params);
  };

  it('should generate a valid pie chart label with template', () => {
    expect(
      format({
        label_type: 'template',
        label_template: '{name}:{value}\n{percent}',
      }),
    ).toEqual('Tablet:123k\n55.50%');
  });

  it('should be formatted using the number formatter', () => {
    expect(
      format({
        label_type: 'template',
        label_template: '{name}:{value}\n{percent}',
        number_format: ',d',
      }),
    ).toEqual('Tablet:123,456\n55.50%');
  });

  it('should be compatible with ECharts raw variable syntax', () => {
    expect(
      format({
        label_type: 'template',
        label_template: '{b}:{c}\n{d}',
        number_format: ',d',
      }),
    ).toEqual('Tablet:123456\n55.5');
  });
});

describe('Total value positioning with legends', () => {
  const getChartPropsWithLegend = (
    showTotal = true,
    showLegend = true,
    legendOrientation = 'right',
    donut = true,
  ): EchartsPieChartProps => {
    const formData: SqlaFormData = {
      colorScheme: 'bnbColors',
      datasource: '3__table',
      granularity_sqla: 'ds',
      metric: 'sum__num',
      groupby: ['category'],
      viz_type: 'pie',
      show_total: showTotal,
      show_legend: showLegend,
      legend_orientation: legendOrientation,
      donut,
    };

    return new ChartProps({
      formData,
      width: 800,
      height: 600,
      queriesData: [
        {
          data: [
            { category: 'A', sum__num: 10, sum__num__contribution: 0.4 },
            { category: 'B', sum__num: 15, sum__num__contribution: 0.6 },
          ],
        },
      ],
      theme: supersetTheme,
    }) as EchartsPieChartProps;
  };

  it('should center total text when legend is on the right', () => {
    const props = getChartPropsWithLegend(true, true, 'right', true);
    const transformed = transformProps(props);

    expect(transformed.echartOptions.graphic).toEqual(
      expect.objectContaining({
        type: 'text',
        left: expect.stringMatching(/^\d+(\.\d+)?%$/),
        top: 'middle',
        style: expect.objectContaining({
          text: expect.stringContaining('Total:'),
        }),
      }),
    );

    // The left position should be less than 50% (shifted left)
    const leftValue = parseFloat(
      (transformed.echartOptions.graphic as any).left.replace('%', ''),
    );
    expect(leftValue).toBeLessThan(50);
    expect(leftValue).toBeGreaterThan(30); // Should be reasonable positioning
  });

  it('should center total text when legend is on the left', () => {
    const props = getChartPropsWithLegend(true, true, 'left', true);
    const transformed = transformProps(props);

    expect(transformed.echartOptions.graphic).toEqual(
      expect.objectContaining({
        type: 'text',
        left: expect.stringMatching(/^\d+(\.\d+)?%$/),
        top: 'middle',
      }),
    );

    // The left position should be greater than 50% (shifted right)
    const leftValue = parseFloat(
      (transformed.echartOptions.graphic as any).left.replace('%', ''),
    );
    expect(leftValue).toBeGreaterThan(50);
    expect(leftValue).toBeLessThan(70); // Should be reasonable positioning
  });

  it('should center total text when legend is on top', () => {
    const props = getChartPropsWithLegend(true, true, 'top', true);
    const transformed = transformProps(props);

    expect(transformed.echartOptions.graphic).toEqual(
      expect.objectContaining({
        type: 'text',
        left: 'center',
        top: expect.stringMatching(/^\d+(\.\d+)?%$/),
      }),
    );

    // The top position should be adjusted for top legend
    const topValue = parseFloat(
      (transformed.echartOptions.graphic as any).top.replace('%', ''),
    );
    expect(topValue).toBeGreaterThan(50); // Shifted down for top legend
  });

  it('should center total text when legend is on bottom', () => {
    const props = getChartPropsWithLegend(true, true, 'bottom', true);
    const transformed = transformProps(props);

    expect(transformed.echartOptions.graphic).toEqual(
      expect.objectContaining({
        type: 'text',
        left: 'center',
        top: expect.stringMatching(/^\d+(\.\d+)?%$/),
      }),
    );

    // The top position should be adjusted for bottom legend
    const topValue = parseFloat(
      (transformed.echartOptions.graphic as any).top.replace('%', ''),
    );
    expect(topValue).toBeLessThan(50); // Shifted up for bottom legend
  });

  it('should use default positioning when no legend is shown', () => {
    const props = getChartPropsWithLegend(true, false, 'right', true);
    const transformed = transformProps(props);

    expect(transformed.echartOptions.graphic).toEqual(
      expect.objectContaining({
        type: 'text',
        left: 'center',
        top: 'middle',
      }),
    );
  });

  it('should handle regular pie chart (non-donut) positioning', () => {
    const props = getChartPropsWithLegend(true, true, 'right', false);
    const transformed = transformProps(props);

    expect(transformed.echartOptions.graphic).toEqual(
      expect.objectContaining({
        type: 'text',
        top: '0', // Non-donut charts use '0' as default top position
        left: expect.stringMatching(/^\d+(\.\d+)?%$/), // Should still adjust left for right legend
      }),
    );
  });

  it('should not show total graphic when showTotal is false', () => {
    const props = getChartPropsWithLegend(false, true, 'right', true);
    const transformed = transformProps(props);

    expect(transformed.echartOptions.graphic).toBeNull();
  });
});

describe('Other category', () => {
  const defaultFormData: SqlaFormData = {
    colorScheme: 'bnbColors',
    datasource: '3__table',
    granularity_sqla: 'ds',
    metric: 'metric',
    groupby: ['foo', 'bar'],
    viz_type: 'my_viz',
  };

  const getChartProps = (formData: Partial<SqlaFormData>) =>
    new ChartProps({
      formData: {
        ...defaultFormData,
        ...formData,
      },
      width: 800,
      height: 600,
      queriesData: [
        {
          data: [
            {
              foo: 'foo 1',
              bar: 'bar 1',
              metric: 1,
              metric__contribution: 1 / 15, // 6.7%
            },
            {
              foo: 'foo 2',
              bar: 'bar 2',
              metric: 2,
              metric__contribution: 2 / 15, // 13.3%
            },
            {
              foo: 'foo 3',
              bar: 'bar 3',
              metric: 3,
              metric__contribution: 3 / 15, // 20%
            },
            {
              foo: 'foo 4',
              bar: 'bar 4',
              metric: 4,
              metric__contribution: 4 / 15, // 26.7%
            },
            {
              foo: 'foo 5',
              bar: 'bar 5',
              metric: 5,
              metric__contribution: 5 / 15, // 33.3%
            },
          ],
        },
      ],
      theme: supersetTheme,
    });

  it('generates Other category', () => {
    const chartProps = getChartProps({
      threshold_for_other: 20,
    });
    const transformed = transformProps(chartProps as EchartsPieChartProps);
    const series = transformed.echartOptions.series as PieSeriesOption[];
    const data = series[0].data as PieChartDataItem[];
    expect(data).toHaveLength(4);
    expect(data[0].value).toBe(3);
    expect(data[1].value).toBe(4);
    expect(data[2].value).toBe(5);
    expect(data[3].value).toBe(1 + 2);
    expect(data[3].name).toBe('Other');
    expect(data[3].isOther).toBe(true);
  });
});

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
} from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import type { PieSeriesOption } from 'echarts/charts';
import type {
  LabelFormatterCallback,
  CallbackDataParams,
} from 'echarts/types/src/util/types';
import transformProps, {
  parseParams,
  getArcBoundingBox,
  getPieLayout,
} from '../../src/Pie/transformProps';
import { EchartsPieChartProps, PieChartDataItem } from '../../src/Pie/types';
import { LegendOrientation, LegendType } from '../../src/types';

const getGraphic = (transformed: ReturnType<typeof transformProps>) =>
  transformed.echartOptions.graphic as {
    type: string;
    x: number;
    y: number;
    style: { text: string; align: string; verticalAlign: string };
  };

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

  test('should transform chart props for viz', () => {
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

  test('renders every slice when a NULL group value is mixed with named ones', () => {
    // Regression guard for https://github.com/apache/superset/issues/33174:
    // a Pie chart whose groupby dimension contains a NULL/empty value alongside
    // named values reportedly dropped the named slices (or rendered only the
    // NULL one). This asserts the transform keeps one slice per row, mapping the
    // NULL group to the `<NULL>` placeholder and preserving every other slice.
    const nullMixedChartProps = new ChartProps({
      formData: {
        colorScheme: 'bnbColors',
        datasource: '3__table',
        granularity_sqla: 'ds',
        metric: 'sum__num',
        groupby: ['region'],
        viz_type: 'pie',
      } as SqlaFormData,
      width: 800,
      height: 600,
      queriesData: [
        {
          data: [
            { region: '국내', sum__num: 817280006121 },
            { region: '해외', sum__num: 118777753521 },
            { region: null, sum__num: 20596314924 },
          ],
        },
      ],
      theme: supersetTheme,
    });

    const series = (
      transformProps(nullMixedChartProps as EchartsPieChartProps).echartOptions
        .series as PieSeriesOption[]
    )[0];
    const data = series.data as PieChartDataItem[];

    // every input row must still produce a slice -- none are dropped
    expect(data).toHaveLength(3);
    expect(data.map(d => d.name)).toEqual(['국내', '해외', '<NULL>']);
    expect(data.map(d => d.value)).toEqual([
      817280006121, 118777753521, 20596314924,
    ]);
  });

  test('falls back to scroll for plain legends with overlong labels', () => {
    const longLegendChartProps = new ChartProps({
      formData: {
        colorScheme: 'bnbColors',
        datasource: '3__table',
        granularity_sqla: 'ds',
        metric: 'sum__num',
        groupby: ['category'],
        viz_type: 'pie',
        legendType: LegendType.Plain,
        legendOrientation: LegendOrientation.Top,
        showLegend: true,
      } as SqlaFormData,
      width: 320,
      height: 600,
      queriesData: [
        {
          data: [
            {
              category: 'This is a very long pie legend label one',
              sum__num: 10,
            },
            {
              category: 'This is a very long pie legend label two',
              sum__num: 20,
            },
            {
              category: 'This is a very long pie legend label three',
              sum__num: 30,
            },
          ],
        },
      ],
      theme: supersetTheme,
    });

    const transformed = transformProps(
      longLegendChartProps as EchartsPieChartProps,
    );

    expect((transformed.echartOptions.legend as any).type).toBe(
      LegendType.Scroll,
    );
  });
});

describe('formatPieLabel', () => {
  test('should generate a valid pie chart label', () => {
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

  test('should generate a valid pie chart label with template', () => {
    expect(
      format({
        label_type: 'template',
        label_template: '{name}:{value}\n{percent}',
      }),
    ).toEqual('Tablet:123k\n55.50%');
  });

  test('should be formatted using the number formatter', () => {
    expect(
      format({
        label_type: 'template',
        label_template: '{name}:{value}\n{percent}',
        number_format: ',d',
      }),
    ).toEqual('Tablet:123,456\n55.50%');
  });

  test('should be compatible with ECharts raw variable syntax', () => {
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

  test('should center total text when legend is on the right', () => {
    const props = getChartPropsWithLegend(true, true, 'right', true);
    const graphic = getGraphic(transformProps(props));

    expect(graphic.type).toBe('text');
    expect(graphic.style.text).toContain('Total:');
    expect(graphic.style.align).toBe('center');
    expect(graphic.style.verticalAlign).toBe('middle');
    // Anchored on the pie origin, which shifts left of the container center
    // because the right legend narrows the series rect.
    expect(graphic.x).toBeLessThan(400);
    expect(graphic.y).toBe(300);
  });

  test('should center total text when legend is on the left', () => {
    const props = getChartPropsWithLegend(true, true, 'left', true);
    const graphic = getGraphic(transformProps(props));

    // The left legend pads the rect, pushing the pie origin right.
    expect(graphic.x).toBeGreaterThan(400);
    expect(graphic.y).toBe(300);
  });

  test('should center total text when legend is on top', () => {
    const props = getChartPropsWithLegend(true, true, 'top', true);
    const graphic = getGraphic(transformProps(props));

    expect(graphic.x).toBe(400);
    expect(graphic.y).toBeGreaterThan(300);
  });

  test('should center total text when legend is on bottom', () => {
    const props = getChartPropsWithLegend(true, true, 'bottom', true);
    const graphic = getGraphic(transformProps(props));

    expect(graphic.x).toBe(400);
    expect(graphic.y).toBeLessThan(300);
  });

  test('should center on the pie origin when no legend is shown', () => {
    const props = getChartPropsWithLegend(true, false, 'right', true);
    const graphic = getGraphic(transformProps(props));

    expect(graphic.x).toBe(400);
    expect(graphic.y).toBe(300);
    expect(graphic.style.verticalAlign).toBe('middle');
  });

  test('should park total at the top of the rect for non-donut charts', () => {
    const props = getChartPropsWithLegend(true, true, 'right', false);
    const graphic = getGraphic(transformProps(props));

    expect(graphic.y).toBe(0);
    expect(graphic.style.verticalAlign).toBe('top');
    // Horizontally centered over the narrowed rect, not the container.
    expect(graphic.x).toBeLessThan(400);
  });

  test('should not show total graphic when showTotal is false', () => {
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

  test('generates Other category', () => {
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

describe('legend sorting', () => {
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
              foo: 'A foo',
              bar: 'A bar',
              metric: 1,
            },
            {
              foo: 'D foo',
              bar: 'D bar',
              metric: 2,
            },

            {
              foo: 'C foo',
              bar: 'C bar',
              metric: 3,
            },
            {
              foo: 'B foo',
              bar: 'B bar',
              metric: 4,
            },

            {
              foo: 'E foo',
              bar: 'E bar',
              metric: 5,
            },
          ],
        },
      ],
      theme: supersetTheme,
    });

  test('sort legend by data', () => {
    const chartProps = getChartProps({
      legendSort: null,
    });
    const transformed = transformProps(chartProps as EchartsPieChartProps);

    expect((transformed.echartOptions.legend as any).data).toEqual([
      'A foo, A bar',
      'D foo, D bar',
      'C foo, C bar',
      'B foo, B bar',
      'E foo, E bar',
    ]);
  });

  test('sort legend by label ascending', () => {
    const chartProps = getChartProps({
      legendSort: 'asc',
    });
    const transformed = transformProps(chartProps as EchartsPieChartProps);

    expect((transformed.echartOptions.legend as any).data).toEqual([
      'A foo, A bar',
      'B foo, B bar',
      'C foo, C bar',
      'D foo, D bar',
      'E foo, E bar',
    ]);
  });

  test('sort legend by label descending', () => {
    const chartProps = getChartProps({
      legendSort: 'desc',
    });
    const transformed = transformProps(chartProps as EchartsPieChartProps);

    expect((transformed.echartOptions.legend as any).data).toEqual([
      'E foo, E bar',
      'D foo, D bar',
      'C foo, C bar',
      'B foo, B bar',
      'A foo, A bar',
    ]);
  });
});

const getAngleChartProps = (
  donut: boolean,
  sweptAngle: number,
  startAngle: number = 180,
) => {
  const formData: SqlaFormData = {
    colorScheme: 'bnbColors',
    datasource: '3__table',
    granularity_sqla: 'ds',
    metric: 'sum__num',
    groupby: ['category'],
    viz_type: 'pie',
    donut,
    startAngle,
    sweptAngle,
    show_total: true,
    show_legend: false,
  };

  return new ChartProps({
    formData,
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [
          { category: 'A', sum__num: 10, sum__num__contribution: 0.5 },
          { category: 'B', sum__num: 10, sum__num__contribution: 0.5 },
        ],
      },
    ],
    theme: supersetTheme,
  }) as EchartsPieChartProps;
};

const getSeries = (props: EchartsPieChartProps) =>
  transformProps(props).echartOptions.series as PieSeriesOption[];

test('keeps ECharts default layout for a full donut', () => {
  const series = getSeries(getAngleChartProps(true, 360, 90));
  expect(series[0].center).toEqual([400, 300]);
  expect(series[0].radius).toEqual(['30%', '70%']);
});

test('recenters and scales up a top half-donut', () => {
  // Bounding box is 2 wide x 1 tall, so an 800x600 canvas fits a radius
  // basis of min(800/2, 600/1) = 400 instead of 300: scale 4/3.
  const series = getSeries(getAngleChartProps(true, 180, 180));
  expect(series[0].center).toEqual([400, 440]);
  expect(series[0].radius).toEqual(['40%', '93.33%']);
});

test('recenters a bottom half-donut upwards', () => {
  const series = getSeries(getAngleChartProps(true, 180, 0));
  expect(series[0].center).toEqual([400, 160]);
});

test('recenters a right half-donut leftwards without scaling', () => {
  // A lateral half is 1 wide x 2 tall; height binds at the full-circle
  // basis, so the radius stays put and only the center shifts.
  const series = getSeries(getAngleChartProps(true, 180, 90));
  expect(series[0].center).toEqual([295, 300]);
  expect(series[0].radius).toEqual(['30%', '70%']);
});

test('recenters a left half-donut rightwards', () => {
  const series = getSeries(getAngleChartProps(true, 180, 270));
  expect(series[0].center).toEqual([505, 300]);
});

test('recenters non-cardinal start angles too', () => {
  const series = getSeries(getAngleChartProps(true, 180, 170));
  expect(series[0].center).not.toEqual([400, 300]);
});

test('scales a quarter donut to the fit cap', () => {
  const series = getSeries(getAngleChartProps(true, 90, 180));
  expect(series[0].center).toEqual([610, 510]);
  expect(series[0].radius).toEqual(['60%', '140%']);
});

test('passes startAngle through and derives endAngle from the sweep', () => {
  const series = getSeries(getAngleChartProps(true, 180, 90));
  expect(series[0].startAngle).toBe(90);
  expect(series[0].endAngle).toBe(-90);
});

test('anchors the total on the pie origin for a top half-donut', () => {
  const graphic = getGraphic(
    transformProps(getAngleChartProps(true, 180, 180)),
  );
  expect(graphic.x).toBe(400);
  expect(graphic.y).toBe(440);
});

test.each([
  ['full circle', 90, 360, 0.3, { minX: -1, maxX: 1, minY: -1, maxY: 1 }],
  ['top half', 180, 180, 0, { minX: -1, maxX: 1, minY: 0, maxY: 1 }],
  ['bottom half', 0, 180, 0, { minX: -1, maxX: 1, minY: -1, maxY: 0 }],
  ['right half', 90, 180, 0, { minX: 0, maxX: 1, minY: -1, maxY: 1 }],
  ['left half', 270, 180, 0, { minX: -1, maxX: 0, minY: -1, maxY: 1 }],
  ['top-left quarter', 180, 90, 0.5, { minX: -1, maxX: 0, minY: 0, maxY: 1 }],
])('getArcBoundingBox: %s', (_label, start, sweep, inner, expected) => {
  const box = getArcBoundingBox(start, sweep, inner);
  expect(box.minX).toBeCloseTo(expected.minX, 10);
  expect(box.maxX).toBeCloseTo(expected.maxX, 10);
  expect(box.minY).toBeCloseTo(expected.minY, 10);
  expect(box.maxY).toBeCloseTo(expected.maxY, 10);
});

test('getArcBoundingBox includes inner arc endpoints for narrow donuts', () => {
  // A 20-degree sliver straddling 12 o'clock: the lowest point of the
  // annular sector is an inner endpoint, not an outer one.
  const box = getArcBoundingBox(100, 20, 0.5);
  expect(box.minY).toBeCloseTo(0.5 * Math.sin((80 * Math.PI) / 180), 10);
  expect(box.maxY).toBeCloseTo(1, 10);
});

test('getPieLayout centers the bounding box within legend padding', () => {
  const layout = getPieLayout({
    width: 800,
    height: 600,
    padding: { top: 0, bottom: 0, left: 0, right: 200 },
    startAngle: 90,
    sweptAngle: 360,
    donut: true,
    innerRadius: 30,
    outerRadius: 70,
  });
  // Rect is 600x600; the pie centers within it and the total anchor is
  // reported in container coordinates.
  expect(layout.center).toEqual([300, 300]);
  expect(layout.totalAnchor).toEqual({ x: 300, y: 300 });
});

test('clamps the total anchor into the arc box for narrow arcs', () => {
  // A 20-degree sliver's pie origin falls far below the drawn wedge; the
  // anchor must stay within the arc's bounding box so the text is visible.
  const graphic = getGraphic(transformProps(getAngleChartProps(true, 20, 100)));
  expect(graphic.x).toBe(400);
  expect(graphic.y).toBeCloseTo(421.37, 1);
});

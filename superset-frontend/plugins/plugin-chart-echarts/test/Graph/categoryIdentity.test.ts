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
  CategoricalColorNamespace,
  ChartProps,
  getLabelsColorMap,
  LabelsColorMapSource,
  SqlaFormData,
} from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import { init, use } from 'echarts/core';
import { GraphChart, GraphSeriesOption, PieSeriesOption } from 'echarts/charts';
import { LegendComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import transformProps from '../../src/Graph/transformProps';
import transformPie from '../../src/Pie/transformProps';
import { EchartsPieChartProps, PieChartDataItem } from '../../src/Pie/types';
import { NULL_STRING } from '../../src/constants';
import { EChartGraphNode, EchartsGraphChartProps } from '../../src/Graph/types';

const colorMap = getLabelsColorMap();
const previousSource = colorMap.source;

beforeEach(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    measureText: (text: string) => ({ width: text.length * 7 }),
  } as never);
  colorMap.reset();
  colorMap.source = LabelsColorMapSource.Explore;
});

afterEach(() => {
  jest.restoreAllMocks();
  colorMap.reset();
  colorMap.source = previousSource;
  CategoricalColorNamespace.getNamespace().resetColors();
});

/** Build a source/target pair for each category through the real transform. */
function transform(
  values: (string | null | undefined)[],
  overrides: Partial<SqlaFormData> = {},
  legendState?: Record<string, boolean>,
) {
  const formData: SqlaFormData = {
    datasource: '1__table',
    viz_type: 'graph_chart',
    source: 'source',
    target: 'target',
    sourceCategory: 'category',
    targetCategory: 'category',
    metric: 'weight',
    showLegend: true,
    legendType: 'plain',
    layout: 'circular',
    ...overrides,
  };
  return transformProps(
    new ChartProps({
      width: 800,
      height: 600,
      theme: supersetTheme,
      formData,
      legendState,
      queriesData: [
        {
          data: values.map((category, index) => ({
            source: `source-${index}`,
            target: `target-${index}`,
            category,
            weight: 1,
          })),
        },
      ],
    }) as EchartsGraphChartProps,
  );
}

/** Assert that nodes and outgoing edges use their category's legend color. */
function expectConsistentColors(series: GraphSeriesOption) {
  const nodes = series.data as EChartGraphNode[];
  const colors = new Map(
    series.categories!.map(category => [
      category.name,
      category.itemStyle?.color,
    ]),
  );
  nodes.forEach(node =>
    expect(node.itemStyle?.color).toBe(colors.get(node.category as string)),
  );
  series.links!.forEach(link => {
    expect(link.lineStyle?.color).toBe(
      nodes[Number(link.source)].itemStyle?.color,
    );
  });
}

test.each([null, undefined])(
  'keeps %s, literal N/A and literal <NULL> distinct',
  value => {
    const { echartOptions } = transform([value, 'N/A', NULL_STRING]);
    const [series] = echartOptions.series as GraphSeriesOption[];
    const nodes = series.data as EChartGraphNode[];
    expect(series.categories!.map(category => category.name)).toEqual([
      NULL_STRING,
      'N/A',
      '"<NULL>"',
    ]);
    expect((echartOptions.legend as { data: string[] }).data).toEqual([
      NULL_STRING,
      'N/A',
      '"<NULL>"',
    ]);
    expect(new Set(nodes.map(node => node.category)).size).toBe(3);
    expect(new Set(nodes.map(node => node.itemStyle?.color)).size).toBe(3);
    expectConsistentColors(series);
  },
);

test.each([LabelsColorMapSource.Explore, LabelsColorMapSource.Dashboard])(
  'honors custom colors for null and distinct literal categories in context %s',
  source => {
    colorMap.source = source;
    const colors: Record<string, string> = {
      [NULL_STRING]: '#e53935',
      'N/A': '#123456',
      '"<NULL>"': '#abcdef',
      __superset_null__: '#654321',
    };
    Object.entries(colors).forEach(([label, color]) =>
      CategoricalColorNamespace.getNamespace().setColor(label, color),
    );
    const [series] = transform([null, 'N/A', NULL_STRING, '__superset_null__'])
      .echartOptions.series as GraphSeriesOption[];
    const nodes = series.data as EChartGraphNode[];
    expect(
      nodes
        .filter((_, index) => index % 2 === 0)
        .map(node => node.itemStyle?.color),
    ).toEqual(Object.values(colors));
    expectConsistentColors(series);
  },
);

test.each(['pie-first', 'graph-first'])(
  'shares saved null colors with Pie in either render order (%s)',
  order => {
    colorMap.source = LabelsColorMapSource.Dashboard;
    const savedColor = CategoricalColorNamespace.getScale().range()[3];
    colorMap.addSlice(NULL_STRING, savedColor, 40);
    const renderPie = () => {
      const formData: SqlaFormData = {
        datasource: '1__table',
        viz_type: 'pie',
        groupby: ['category'],
        metric: 'weight',
        sliceId: 41,
      };
      const result = transformPie(
        new ChartProps({
          width: 800,
          height: 600,
          theme: supersetTheme,
          formData,
          queriesData: [
            {
              data: [
                { category: null, weight: 1 },
                { category: 'N/A', weight: 1 },
              ],
            },
          ],
        }) as EchartsPieChartProps,
      );
      return (
        (result.echartOptions.series as PieSeriesOption[])[0]
          .data as PieChartDataItem[]
      )[0].itemStyle?.color;
    };
    const renderGraph = () => {
      const [series] = transform([null, 'N/A'], { sliceId: 42 }).echartOptions
        .series as GraphSeriesOption[];
      expectConsistentColors(series);
      return (series.data as EChartGraphNode[])[0].itemStyle?.color;
    };
    const colors =
      order === 'pie-first'
        ? [renderPie(), renderGraph()]
        : [renderGraph(), renderPie()];
    expect(colors).toEqual([savedColor, savedColor]);
    expect(colorMap.getColorMap().get(NULL_STRING)).toBe(savedColor);
  },
);

test.each(
  [false, true].flatMap(nullFirst =>
    [undefined, 42].map(sliceId => ({ nullFirst, sliceId })),
  ),
)(
  'keeps node, edge and legend colors aligned after a saved color displaces an automatic color (null first $nullFirst, slice $sliceId)',
  ({ nullFirst, sliceId }) => {
    colorMap.source = LabelsColorMapSource.Dashboard;
    const savedColor = CategoricalColorNamespace.getScale().range()[0];
    colorMap.addSlice(NULL_STRING, savedColor, 41);
    const values = nullFirst
      ? [null, 'N/A', NULL_STRING]
      : ['N/A', NULL_STRING, null];
    const [series] = transform(values, { sliceId }).echartOptions
      .series as GraphSeriesOption[];
    const categories = series.categories!;
    expect(
      categories.find(category => category.name === NULL_STRING)?.itemStyle
        ?.color,
    ).toBe(savedColor);
    expect(
      new Set(categories.map(category => category.itemStyle?.color)).size,
    ).toBe(3);
    expectConsistentColors(series);
  },
);

test('preserves shared null colors across filters and rerenders', () => {
  colorMap.source = LabelsColorMapSource.Dashboard;
  const [initial] = transform([null, 'N/A', NULL_STRING], { sliceId: 42 })
    .echartOptions.series as GraphSeriesOption[];
  const expected = initial.categories!.find(
    category => category.name === NULL_STRING,
  )?.itemStyle?.color;
  expect(colorMap.getColorMap().get(NULL_STRING)).toBe(expected);
  for (const values of [[null], ['N/A', null], [null, 'N/A', NULL_STRING]]) {
    const [series] = transform(values, { sliceId: 42 }).echartOptions
      .series as GraphSeriesOption[];
    expect(
      series.categories!.find(category => category.name === NULL_STRING)
        ?.itemStyle?.color,
    ).toBe(expected);
    expectConsistentColors(series);
  }
});

test.each([undefined, 42])(
  'keeps custom null color separate when null is filtered out (slice %s)',
  sliceId => {
    CategoricalColorNamespace.getNamespace().setColor(NULL_STRING, '#e53935');
    const [series] = transform(['N/A', NULL_STRING], { sliceId }).echartOptions
      .series as GraphSeriesOption[];
    expect(series.categories!.map(category => category.name)).toEqual([
      'N/A',
      '"<NULL>"',
    ]);
    expect(
      series.categories!.every(
        category => category.itemStyle?.color !== '#e53935',
      ),
    ).toBe(true);
    expectConsistentColors(series);
  },
);

test('escapes literal null labels and leading quotes without color-key collisions', () => {
  const values = [
    null,
    NULL_STRING,
    '"<NULL>"',
    '"\\"<NULL>\\""',
    ' <NULL> ',
    ' "<NULL>" ',
    '__superset_null__',
  ];
  const { echartOptions } = transform(values);
  const labels = (echartOptions.legend as { data: string[] }).data;
  expect(labels).toEqual([
    NULL_STRING,
    ...values.slice(1, -1).map(value => JSON.stringify(value)),
    '__superset_null__',
  ]);
  expect(new Set(labels.map(label => label.trim())).size).toBe(values.length);
  const [series] = echartOptions.series as GraphSeriesOption[];
  expect(
    new Set(series.categories!.map(category => category.itemStyle?.color)).size,
  ).toBe(values.length);
  expectConsistentColors(series);
});

test.each(['N/A', '"<NULL>"', '"\\"<NULL>\\""'])(
  'ECharts legend selection keeps null and <NULL> independent of %s',
  literal => {
    use([GraphChart, LegendComponent, TooltipComponent, SVGRenderer]);
    const values = [null, literal, '<NULL>'];
    const { echartOptions } = transform(values);
    const [series] = echartOptions.series as GraphSeriesOption[];
    const names = series.categories!.map(category => category.name as string);
    const chart = init(null, null, {
      renderer: 'svg',
      ssr: true,
      width: 800,
      height: 600,
    });
    const model = chart as unknown as {
      getModel: () => {
        getSeriesByIndex: (index: number) => {
          getData: () => {
            count: () => number;
            getName: (index: number) => string;
          };
        };
      };
    };
    const visibleNodes = () => {
      const data = model.getModel().getSeriesByIndex(0).getData();
      return Array.from({ length: data.count() }, (_, index) =>
        data.getName(index),
      );
    };
    try {
      chart.setOption({ ...echartOptions, animation: false });
      expect(visibleNodes()).toHaveLength(6);
      chart.dispatchAction({ type: 'legendUnSelect', name: names[0] });
      expect(visibleNodes()).toEqual([
        'source-1',
        'target-1',
        'source-2',
        'target-2',
      ]);
      chart.dispatchAction({ type: 'legendSelect', name: names[0] });
      chart.dispatchAction({ type: 'legendUnSelect', name: names[2] });
      expect(visibleNodes()).toEqual([
        'source-0',
        'target-0',
        'source-1',
        'target-1',
      ]);
      const next = transform(values, {}, { [names[2]]: false });
      chart.setOption(
        { ...next.echartOptions, animation: false },
        { notMerge: true },
      );
      expect(visibleNodes()).toEqual([
        'source-0',
        'target-0',
        'source-1',
        'target-1',
      ]);
      const nullHidden = transform(values, {}, { [names[0]]: false });
      chart.setOption(
        { ...nullHidden.echartOptions, animation: false },
        { notMerge: true },
      );
      expect(visibleNodes()).toEqual([
        'source-1',
        'target-1',
        'source-2',
        'target-2',
      ]);
      chart.dispatchAction({ type: 'legendSelect', name: names[0] });
      chart.dispatchAction({ type: 'legendUnSelect', name: names[1] });
      expect(visibleNodes()).toEqual([
        'source-0',
        'target-0',
        'source-2',
        'target-2',
      ]);
    } finally {
      chart.dispose();
    }
  },
);

test.each(['asc', 'desc'])(
  'sorts the legend by displayed labels (%s)',
  legendSort => {
    const { echartOptions } = transform([null, 'N/A', '<NULL>'], {
      legendSort,
    });
    const legend = echartOptions.legend as {
      data: string[];
    };
    const labels = legend.data;
    const sortedLabels = ['<NULL>', 'N/A', '"<NULL>"'].sort((a, b) =>
      a.localeCompare(b),
    );
    expect(labels).toEqual(
      legendSort === 'asc' ? sortedLabels : sortedLabels.reverse(),
    );
  },
);

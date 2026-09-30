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
import { GraphChart, GraphSeriesOption } from 'echarts/charts';
import { LegendComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import transformProps from '../../src/Graph/transformProps';
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

test.each([null, undefined])(
  'keeps %s, literal N/A and literal <NULL> distinct',
  value => {
    const { echartOptions } = transform([value, 'N/A', '<NULL>']);
    const [series] = echartOptions.series as GraphSeriesOption[];
    const nodes = series.data as EChartGraphNode[];
    expect(series.categories).toHaveLength(3);
    expect(new Set(nodes.map(node => node.category)).size).toBe(3);
    expect(new Set(nodes.map(node => node.itemStyle?.color)).size).toBe(3);
    expect(nodes[0].category).toBe(nodes[1].category);
    expect(nodes[2].category).toBe(nodes[3].category);
    expect(nodes[4].category).toBe(nodes[5].category);
  },
);

test('keeps literal internal identifiers separate from null, including normalized color keys', () => {
  const [initial] = transform([null]).echartOptions
    .series as GraphSeriesOption[];
  const nullKey = initial.categories![0].name as string;
  const values = [null, nullKey, `${nullKey}${nullKey}`, ` ${nullKey} `];
  const [series] = transform(values).echartOptions
    .series as GraphSeriesOption[];
  const nodes = series.data as EChartGraphNode[];
  expect(series.categories).toHaveLength(values.length);
  expect(new Set(nodes.map(node => node.category)).size).toBe(values.length);
  expect(new Set(nodes.map(node => node.itemStyle?.color)).size).toBe(3);
  // Literal values share the color lookup's existing whitespace normalization.
  expect(nodes[2].itemStyle?.color).toBe(nodes[6].itemStyle?.color);
  expect(nodes[0].itemStyle?.color).not.toBe(nodes[6].itemStyle?.color);
});

test('displays readable labels without exposing category identifiers', () => {
  const { echartOptions } = transform([null, 'N/A', '<NULL>']);
  const legend = echartOptions.legend as {
    data: string[];
    formatter: (name: string) => string;
  };
  expect(legend.data.map(legend.formatter)).toEqual([
    '<NULL>',
    'N/A',
    '"<NULL>"',
  ]);
});

test.each([LabelsColorMapSource.Explore, LabelsColorMapSource.Dashboard])(
  'preserves explicit colors for literal categories in context %s',
  source => {
    colorMap.source = source;
    CategoricalColorNamespace.getNamespace().setColor('N/A', '#123456');
    CategoricalColorNamespace.getNamespace().setColor('<NULL>', '#abcdef');
    const [series] = transform([null, 'N/A', '<NULL>']).echartOptions
      .series as GraphSeriesOption[];
    const nodes = series.data as EChartGraphNode[];
    expect(nodes[2].itemStyle?.color).toBe('#123456');
    expect(nodes[4].itemStyle?.color).toBe('#abcdef');
    expect(nodes[0].itemStyle?.color).not.toBe('#abcdef');
  },
);

test.each(
  [LabelsColorMapSource.Explore, LabelsColorMapSource.Dashboard].flatMap(
    source => [false, true].map(withNull => ({ source, withNull })),
  ),
)(
  'preserves reserved literal custom colors (context $source, null $withNull)',
  ({ source, withNull }) => {
    colorMap.source = source;
    const reserved = '__superset_null__';
    const literalColors: Record<string, string> = {
      [reserved]: '#123456',
      [`${reserved}${reserved}`]: '#abcdef',
    };
    Object.entries(literalColors).forEach(([label, color]) => {
      CategoricalColorNamespace.getNamespace().setColor(label, color);
    });
    const values: (string | null)[] = [
      reserved,
      `${reserved}${reserved}`,
      ` ${reserved} `,
    ];
    if (withNull) values.unshift(null);
    const [series] = transform(values, { sliceId: 42 }).echartOptions
      .series as GraphSeriesOption[];
    const nodes = series.data as EChartGraphNode[];
    values.forEach((value, index) => {
      const pair = nodes.slice(index * 2, index * 2 + 2);
      pair.forEach(node => {
        if (value === null) {
          expect(Object.values(literalColors)).not.toContain(
            node.itemStyle?.color,
          );
        } else {
          expect(node.itemStyle?.color).toBe(literalColors[value.trim()]);
        }
        const category = series.categories!.find(c => c.name === node.category);
        expect(node.itemStyle?.color).toBe(category?.itemStyle?.color);
      });
    });
    expect(CategoricalColorNamespace.getNamespace().forcedItems).toEqual(
      literalColors,
    );
  },
);

test.each([LabelsColorMapSource.Explore, LabelsColorMapSource.Dashboard])(
  'does not apply a filtered-out literal custom color to null in context %s',
  source => {
    colorMap.source = source;
    CategoricalColorNamespace.getNamespace().setColor(
      '__superset_null__',
      '#123456',
    );
    const [series] = transform([null], { sliceId: 42 }).echartOptions
      .series as GraphSeriesOption[];
    (series.data as EChartGraphNode[]).forEach(node => {
      expect(node.itemStyle?.color).not.toBe('#123456');
    });
  },
);

test('preserves saved reserved literal colors across Dashboard rerenders', () => {
  colorMap.source = LabelsColorMapSource.Dashboard;
  const reserved = '__superset_null__';
  const [reservedColor, naColor] = CategoricalColorNamespace.getScale().range();
  colorMap.addSlice(reserved, reservedColor, 41);
  colorMap.addSlice('N/A', naColor, 41);
  const render = () => {
    const [series] = transform([null, reserved, 'N/A'], {
      sliceId: 42,
    }).echartOptions.series as GraphSeriesOption[];
    const nodes = series.data as EChartGraphNode[];
    expect(nodes[2].itemStyle?.color).toBe(reservedColor);
    expect(nodes[4].itemStyle?.color).toBe(naColor);
    expect(new Set(nodes.map(node => node.itemStyle?.color)).size).toBe(3);
    nodes.forEach(node => {
      const category = series.categories!.find(c => c.name === node.category);
      expect(node.itemStyle?.color).toBe(category?.itemStyle?.color);
    });
    return nodes.map(node => node.itemStyle?.color);
  };
  const first = render();
  const saved = new Map(colorMap.getColorMap());
  expect(render()).toEqual(first);
  expect(colorMap.getColorMap()).toEqual(saved);
  expect(colorMap.getColorMap().get(reserved)).toBe(reservedColor);
});

test('distinguishes null and literal labels containing quotes or escapes', () => {
  const values = [null, '<NULL>', '"<NULL>"', '"\\"<NULL>\\""', '"quoted"'];
  const { legend } = transform(values).echartOptions as {
    legend: { data: string[]; formatter: (key: string) => string };
  };
  const labels = legend.data.map(legend.formatter);
  expect(labels.slice(0, 3)).toEqual(['<NULL>', '"<NULL>"', '"\\"<NULL>\\""']);
  expect(new Set(labels).size).toBe(values.length);
  expect(labels.slice(1).map(label => JSON.parse(label))).toEqual(
    values.slice(1),
  );
});

test.each([{ values: [null, 'N/A'] }, { values: [null, 'N/A', '<NULL>'] }])(
  'keeps node, edge and legend colors consistent with saved Dashboard colors ($values)',
  ({ values }) => {
    colorMap.source = LabelsColorMapSource.Dashboard;
    const [nullLabelColor, naColor] =
      CategoricalColorNamespace.getScale().range();
    colorMap.addSlice('<NULL>', nullLabelColor, 41);
    colorMap.addSlice('N/A', naColor, 41);
    const [series] = transform(values, { sliceId: 42 }).echartOptions
      .series as GraphSeriesOption[];
    const nodes = series.data as EChartGraphNode[];
    const categoryColors = new Map(
      series.categories!.map(category => [
        category.name,
        category.itemStyle?.color,
      ]),
    );
    expect(new Set(categoryColors.values()).size).toBe(values.length);
    nodes.forEach(node => {
      expect(node.itemStyle?.color).toBe(
        categoryColors.get(node.category as string),
      );
    });
    series.links!.forEach(link => {
      expect(link.lineStyle?.color).toBe(
        nodes[Number(link.source)].itemStyle?.color,
      );
    });
    expect(categoryColors.get('N/A')).toBe(naColor);
    if (values.includes('<NULL>')) {
      expect(categoryColors.get('<NULL>')).toBe(nullLabelColor);
    }
  },
);

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
      formatter: (name: string) => string;
    };
    const labels = legend.data.map(legend.formatter);
    const sortedLabels = ['<NULL>', 'N/A', '"<NULL>"'].sort((a, b) =>
      a.localeCompare(b),
    );
    expect(labels).toEqual(
      legendSort === 'asc' ? sortedLabels : sortedLabels.reverse(),
    );
  },
);

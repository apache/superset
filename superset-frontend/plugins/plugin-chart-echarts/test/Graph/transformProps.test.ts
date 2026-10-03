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
  getLabelsColorMap,
  LabelsColorMapSource,
  SqlaFormData,
} from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import type { GraphSeriesOption } from 'echarts/charts';
import transformProps from '../../src/Graph/transformProps';
import { NULL_STRING } from '../../src/constants';
import { DEFAULT_GRAPH_SERIES_OPTION } from '../../src/Graph/constants';
import { EChartGraphNode, EchartsGraphChartProps } from '../../src/Graph/types';

const formData: SqlaFormData = {
  colorScheme: 'bnbColors',
  datasource: '3__table',
  granularity_sqla: 'ds',
  metric: 'count',
  source: 'source_column',
  target: 'target_column',
  category: null,
  viz_type: 'graph',
};
const queriesData = [
  {
    colnames: ['source_column', 'target_column', 'count'],
    data: [
      {
        source_column: 'source_value_1',
        target_column: 'target_value_1',
        count: 6,
      },
      {
        source_column: 'source_value_2',
        target_column: 'target_value_2',
        count: 5,
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

test.each([null, undefined])(
  'keeps %s categories separate from literal N/A for source and target nodes',
  category => {
    const chartProps = new ChartProps({
      ...chartPropsConfig,
      formData: {
        ...formData,
        sourceCategory: 'source_category_column',
        targetCategory: 'target_category_column',
      },
      queriesData: [
        {
          data: queriesData[0].data.map((row, index) => ({
            ...row,
            source_category_column: index === 0 ? category : 'N/A',
            target_category_column: index === 0 ? category : 'N/A',
          })),
        },
      ],
    });
    const labelsColorMap = getLabelsColorMap();
    const previousSource = labelsColorMap.source;
    labelsColorMap.source = LabelsColorMapSource.Explore;
    try {
      const { echartOptions } = transformProps(
        chartProps as EchartsGraphChartProps,
      );
      const [series] = echartOptions.series as GraphSeriesOption[];
      const nodes = series.data as EChartGraphNode[];
      const nullKey = nodes[0].category;
      const legend = echartOptions.legend as {
        data: string[];
        formatter: (key: string) => string;
      };

      expect(legend.data.map(legend.formatter)).toEqual([NULL_STRING, 'N/A']);
      expect(series.categories).toEqual([
        expect.objectContaining({ name: nullKey }),
        expect.objectContaining({ name: 'N/A' }),
      ]);
      expect(series.data).toEqual([
        expect.objectContaining({
          name: 'source_value_1',
          category: nullKey,
        }),
        expect.objectContaining({
          name: 'target_value_1',
          category: nullKey,
        }),
        expect.objectContaining({ name: 'source_value_2', category: 'N/A' }),
        expect.objectContaining({ name: 'target_value_2', category: 'N/A' }),
      ]);
      expect(nodes[0].itemStyle?.color).not.toEqual(nodes[2].itemStyle?.color);
    } finally {
      labelsColorMap.source = previousSource;
    }
  },
);

test.each([false, true, 0])('preserves the label for category %s', category => {
  const chartProps = new ChartProps({
    ...chartPropsConfig,
    formData: {
      ...formData,
      sourceCategory: 'source_category_column',
      targetCategory: 'target_category_column',
    },
    queriesData: [
      {
        data: [
          {
            ...queriesData[0].data[0],
            source_category_column: category,
            target_category_column: category,
          },
        ],
      },
    ],
  });
  const { echartOptions } = transformProps(
    chartProps as EchartsGraphChartProps,
  );
  const [series] = echartOptions.series as GraphSeriesOption[];

  expect(series.data).toEqual(
    ['source', 'target'].map(column =>
      expect.objectContaining({
        category:
          typeof category === 'boolean'
            ? `${column}_category_column: ${category}`
            : '0',
      }),
    ),
  );
});

describe('EchartsGraph transformProps', () => {
  test('should transform chart props for viz without category', () => {
    const chartProps = new ChartProps(chartPropsConfig);
    expect(transformProps(chartProps as EchartsGraphChartProps)).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          legend: expect.objectContaining({
            data: [],
          }),
          series: expect.arrayContaining([
            expect.objectContaining({
              data: [
                {
                  col: 'source_column',
                  category: undefined,
                  id: '0',
                  itemStyle: {
                    color: '#1f77b4',
                  },
                  label: { show: true },
                  name: 'source_value_1',
                  select: {
                    itemStyle: { borderWidth: 3, opacity: 1 },
                    label: { fontWeight: 'bolder' },
                  },
                  symbolSize: 50,
                  tooltip: expect.anything(),
                  value: 6,
                },
                {
                  col: 'target_column',
                  category: undefined,
                  id: '1',
                  itemStyle: {
                    color: '#1f77b4',
                  },
                  label: { show: true },
                  name: 'target_value_1',
                  select: {
                    itemStyle: { borderWidth: 3, opacity: 1 },
                    label: { fontWeight: 'bolder' },
                  },
                  symbolSize: 50,
                  tooltip: expect.anything(),
                  value: 6,
                },
                {
                  col: 'source_column',
                  category: undefined,
                  id: '2',
                  itemStyle: {
                    color: '#1f77b4',
                  },
                  label: { show: true },
                  name: 'source_value_2',
                  select: {
                    itemStyle: { borderWidth: 3, opacity: 1 },
                    label: { fontWeight: 'bolder' },
                  },
                  symbolSize: 10,
                  tooltip: expect.anything(),
                  value: 5,
                },
                {
                  col: 'target_column',
                  category: undefined,
                  id: '3',
                  itemStyle: {
                    color: '#1f77b4',
                  },
                  label: { show: true },
                  name: 'target_value_2',
                  select: {
                    itemStyle: { borderWidth: 3, opacity: 1 },
                    label: { fontWeight: 'bolder' },
                  },
                  symbolSize: 10,
                  tooltip: expect.anything(),
                  value: 5,
                },
              ],
            }),
            expect.objectContaining({
              links: [
                {
                  emphasis: { lineStyle: { width: 12 } },
                  lineStyle: { width: 6, color: '#1f77b4' },
                  select: {
                    lineStyle: { opacity: 1, width: 9.600000000000001 },
                  },
                  source: '0',
                  target: '1',
                  value: 6,
                },
                {
                  emphasis: { lineStyle: { width: 5 } },
                  lineStyle: { width: 1.5, color: '#1f77b4' },
                  select: { lineStyle: { opacity: 1, width: 5 } },
                  source: '2',
                  target: '3',
                  value: 5,
                },
              ],
            }),
          ]),
        }),
      }),
    );
  });

  test('should transform chart props for viz with category and falsy normalization', () => {
    const formData: SqlaFormData = {
      colorScheme: 'bnbColors',
      datasource: '3__table',
      granularity_sqla: 'ds',
      metric: 'count',
      source: 'source_column',
      target: 'target_column',
      sourceCategory: 'source_category_column',
      targetCategory: 'target_category_column',
      viz_type: 'graph',
    };
    const queriesData = [
      {
        colnames: [
          'source_column',
          'target_column',
          'source_category_column',
          'target_category_column',
          'count',
        ],
        data: [
          {
            source_column: 'source_value',
            target_column: 'target_value',
            source_category_column: 'category_value_1',
            target_category_column: 'category_value_2',
            count: 6,
          },
          {
            source_column: 'source_value',
            target_column: 'target_value',
            source_category_column: 'category_value_1',
            target_category_column: 'category_value_2',
            count: 5,
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

    const chartProps = new ChartProps(chartPropsConfig);
    expect(transformProps(chartProps as EchartsGraphChartProps)).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          legend: expect.objectContaining({
            data: ['category_value_1', 'category_value_2'],
          }),
          series: expect.arrayContaining([
            expect.objectContaining({
              data: [
                {
                  id: '0',
                  itemStyle: {
                    color: '#1f77b4',
                  },
                  col: 'source_column',
                  name: 'source_value',
                  value: 11,
                  symbolSize: 10,
                  category: 'category_value_1',
                  select: DEFAULT_GRAPH_SERIES_OPTION.select,
                  tooltip: expect.anything(),
                  label: { show: true },
                },
                {
                  id: '1',
                  itemStyle: {
                    color: '#ff7f0e',
                  },
                  col: 'target_column',
                  name: 'target_value',
                  value: 11,
                  symbolSize: 10,
                  category: 'category_value_2',
                  select: DEFAULT_GRAPH_SERIES_OPTION.select,
                  tooltip: expect.anything(),
                  label: { show: true },
                },
              ],
            }),
          ]),
        }),
      }),
    );
  });
});

describe('legend sorting', () => {
  const queriesData = [
    {
      colnames: [
        'source_column',
        'target_column',
        'source_category_column',
        'target_category_column',
        'count',
      ],
      data: [
        {
          source_column: 'source_value',
          target_column: 'target_value',
          source_category_column: 'category_value_1',
          target_category_column: 'category_value_3',
          count: 6,
        },
        {
          source_column: 'source_value',
          target_column: 'target_value',
          source_category_column: 'category_value_3',
          target_category_column: 'category_value_2',
          count: 5,
        },
        {
          source_column: 'source_value',
          target_column: 'target_value',
          source_category_column: 'category_value_2',
          target_category_column: 'category_value_1',
          count: 4,
        },
      ],
    },
  ];

  const getChartProps = (overrides = {}) =>
    new ChartProps({
      ...chartPropsConfig,
      formData: {
        ...formData,
        ...overrides,
        sourceCategory: 'source_category_column',
        targetCategory: 'target_category_column',
      },
      queriesData,
    });

  test('sort legend by data', () => {
    const chartProps = getChartProps({
      legendSort: null,
    });
    const transformed = transformProps(chartProps as EchartsGraphChartProps);

    expect((transformed.echartOptions.legend as any).data).toEqual([
      'category_value_1',
      'category_value_3',
      'category_value_2',
    ]);
  });

  test('sort legend by label ascending', () => {
    const chartProps = getChartProps({
      legendSort: 'asc',
    });
    const transformed = transformProps(chartProps as EchartsGraphChartProps);

    expect((transformed.echartOptions.legend as any).data).toEqual([
      'category_value_1',
      'category_value_2',
      'category_value_3',
    ]);
  });

  test('sort legend by label descending', () => {
    const chartProps = getChartProps({
      legendSort: 'desc',
    });
    const transformed = transformProps(chartProps as EchartsGraphChartProps);

    expect((transformed.echartOptions.legend as any).data).toEqual([
      'category_value_3',
      'category_value_2',
      'category_value_1',
    ]);
  });
});

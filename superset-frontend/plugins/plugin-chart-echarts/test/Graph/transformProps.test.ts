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
  ChartDataResponseResult,
  DatasourceType,
  GenericDataType,
  supersetTheme,
} from '@superset-ui/core';
import { LegendOrientation, LegendType } from '../../src/types';
import transformProps from '../../src/Graph/transformProps';
import { DEFAULT_GRAPH_SERIES_OPTION } from '../../src/Graph/constants';
import {
  EchartsGraphChartProps,
  EchartsGraphFormData,
} from '../../src/Graph/types';

describe('EchartsGraph transformProps', () => {
  const baseFormData: EchartsGraphFormData = {
    baseEdgeWidth: 0,
    baseNodeSize: 0,
    draggable: false,
    edgeLength: 0,
    edgeSymbol: '',
    friction: 0,
    gravity: 0,
    legendMargin: 0,
    legendOrientation: LegendOrientation.Left,
    legendType: LegendType.Scroll,
    repulsion: 0,
    roam: 'scale',
    showLegend: false,
    showSymbolThreshold: 0,
    viz_type: 'echarts_graph',
    colorScheme: 'bnbColors',
    datasource: '3__table',
    granularity_sqla: 'ds',
    metric: 'count',
    source: 'source_column',
    target: 'target_column',
    category: null,
  };
  const baseResponseResult: ChartDataResponseResult = {
    error: null,
    is_cached: false,
    query: '',
    rowcount: 2,
    stacktrace: null,
    status: 'success',
    from_dttm: null,
    to_dttm: null,
    coltypes: [
      GenericDataType.STRING,
      GenericDataType.STRING,
      GenericDataType.NUMERIC,
    ],
    cached_dttm: null,
    annotation_data: {},
    cache_key: '',
    cache_timeout: 0,
    colnames: ['source_column', 'target_column', 'count'],
    data: [],
  };
  const baseChartProps: EchartsGraphChartProps = {
    annotationData: {},
    appSection: undefined,
    behaviors: [],
    datasource: {
      id: 1,
      name: 'foo',
      type: DatasourceType.Table,
      columns: [],
      metrics: [],
    },
    filterState: {},
    hooks: {},
    inContextMenu: false,
    initialValues: {},
    inputRef: undefined,
    isRefreshing: false,
    ownState: {},
    rawDatasource: {},
    rawFormData: baseFormData,
    formData: baseFormData,
    width: 800,
    height: 600,
    queriesData: [baseResponseResult],
    theme: supersetTheme,
  };

  it('should transform chart props for viz without category', () => {
    const queriesData: ChartDataResponseResult[] = [
      {
        ...baseResponseResult,
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
    const chartProps = new ChartProps({
      ...baseChartProps,
      queriesData,
    });
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
                  category: undefined,
                  id: '0',
                  label: { show: true },
                  name: 'source_value_1',
                  select: {
                    itemStyle: { borderWidth: 3, opacity: 1 },
                    label: { fontWeight: 'bolder' },
                  },
                  symbolSize: 50,
                  tooltip: { formatter: '{b}: {c}' },
                  value: 6,
                },
                {
                  category: undefined,
                  id: '1',
                  label: { show: true },
                  name: 'target_value_1',
                  select: {
                    itemStyle: { borderWidth: 3, opacity: 1 },
                    label: { fontWeight: 'bolder' },
                  },
                  symbolSize: 50,
                  tooltip: { formatter: '{b}: {c}' },
                  value: 6,
                },
                {
                  category: undefined,
                  id: '2',
                  label: { show: true },
                  name: 'source_value_2',
                  select: {
                    itemStyle: { borderWidth: 3, opacity: 1 },
                    label: { fontWeight: 'bolder' },
                  },
                  symbolSize: 10,
                  tooltip: { formatter: '{b}: {c}' },
                  value: 5,
                },
                {
                  category: undefined,
                  id: '3',
                  label: { show: true },
                  name: 'target_value_2',
                  select: {
                    itemStyle: { borderWidth: 3, opacity: 1 },
                    label: { fontWeight: 'bolder' },
                  },
                  symbolSize: 10,
                  tooltip: { formatter: '{b}: {c}' },
                  value: 5,
                },
              ],
            }),
            expect.objectContaining({
              links: [
                {
                  emphasis: { lineStyle: { width: 12 } },
                  lineStyle: { width: 6 },
                  select: {
                    lineStyle: { opacity: 1, width: 9.600000000000001 },
                  },
                  source: '0',
                  target: '1',
                  value: 6,
                },
                {
                  emphasis: { lineStyle: { width: 5 } },
                  lineStyle: { width: 1.5 },
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

  it('should transform chart props for viz with category and falsey normalization', () => {
    const formData: EchartsGraphFormData = {
      ...baseFormData,
      sourceCategory: 'source_category_column',
      targetCategory: 'target_category_column',
    };
    const queriesData = [
      {
        ...baseResponseResult,
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
    const chartProps = new ChartProps({
      ...baseChartProps,
      formData,
      queriesData,
    });

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
                  name: 'source_value',
                  value: 11,
                  symbolSize: 10,
                  category: 'category_value_1',
                  select: DEFAULT_GRAPH_SERIES_OPTION.select,
                  tooltip: DEFAULT_GRAPH_SERIES_OPTION.tooltip,
                  label: { show: true },
                },
                {
                  id: '1',
                  name: 'target_value',
                  value: 11,
                  symbolSize: 10,
                  category: 'category_value_2',
                  select: DEFAULT_GRAPH_SERIES_OPTION.select,
                  tooltip: DEFAULT_GRAPH_SERIES_OPTION.tooltip,
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

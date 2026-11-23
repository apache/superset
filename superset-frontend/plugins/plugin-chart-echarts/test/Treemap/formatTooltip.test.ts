/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { ChartProps, getNumberFormatter } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import transformProps, {
  formatTooltip,
} from '../../src/Treemap/transformProps';
import {
  EchartsTreemapChartProps,
  TreemapSeriesCallbackDataParams,
} from '../../src/Treemap/types';

test.each([
  { names: ['<NULL>'], expected: '<NULL>' },
  { names: ['parent', '<NULL>'], expected: 'parent ▸ <NULL>' },
  { names: ['<NULL>', 'child'], expected: '<NULL> ▸ child' },
  { names: ['<b>alpha</b> & beta'], expected: '<b>alpha</b> & beta' },
  { names: ['&lt;NULL&gt;'], expected: '&lt;NULL&gt;' },
  { names: ['alpha', 'beta'], expected: 'alpha ▸ beta' },
])('preserves tooltip title as text: $expected', ({ names, expected }) => {
  const params = {
    value: 12,
    treePathInfo: [
      { name: 'total', value: 24 },
      ...names.map(name => ({ name, value: 12 })),
    ],
  } as TreemapSeriesCallbackDataParams;
  const tooltip = document.createElement('div');
  tooltip.innerHTML = formatTooltip({
    params,
    numberFormatter: getNumberFormatter('SMART_NUMBER'),
  });

  expect(tooltip.querySelector('span')?.textContent).toBe(expected);
  expect(tooltip.querySelector('b')).toBeNull();
  expect(tooltip.querySelector('table')?.textContent).toContain('total');
  expect(tooltip.querySelector('table')?.textContent).toContain('12');
});

type TreemapNode = {
  name: string;
  value: number;
  children?: TreemapNode[];
};

test.each([
  { scenario: 'single dimension', groupby: ['category'], prefix: '' },
  {
    scenario: 'nested dimensions',
    groupby: ['parent', 'category'],
    prefix: 'parent ▸ ',
  },
])('renders a NULL tooltip for $scenario', ({ groupby, prefix }) => {
  const chartProps = new ChartProps({
    width: 800,
    height: 600,
    theme: supersetTheme,
    formData: {
      datasource: '1__table',
      viz_type: 'treemap_v2',
      groupby,
      metric: 'total',
    },
    queriesData: [
      {
        data: [
          { parent: 'parent', category: null, total: 10 },
          { parent: 'parent', category: '', total: 11 },
          { parent: 'parent', category: 'null', total: 12 },
          { parent: 'parent', category: 'alpha', total: 13 },
        ],
      },
    ],
  });
  const { echartOptions } = transformProps(
    chartProps as EchartsTreemapChartProps,
  );
  const series = echartOptions.series as { data: TreemapNode[] }[];
  const root = series[0].data[0];
  const parent = groupby.length === 2 ? root.children![0] : root;
  const tooltip = echartOptions.tooltip as {
    formatter: (params: TreemapSeriesCallbackDataParams) => string;
  };
  const titles = parent.children!.map(node => {
    const element = document.createElement('div');
    element.innerHTML = tooltip.formatter({
      value: node.value,
      treePathInfo: groupby.length === 2 ? [root, parent, node] : [root, node],
    } as TreemapSeriesCallbackDataParams);
    return element.querySelector('span')?.textContent ?? '';
  });

  expect(parent.children!.map(node => node.name)).toEqual([
    '<NULL>',
    '',
    'null',
    'alpha',
  ]);
  expect(titles).toEqual([
    `${prefix}<NULL>`,
    prefix ? 'parent' : '',
    `${prefix}null`,
    `${prefix}alpha`,
  ]);
});

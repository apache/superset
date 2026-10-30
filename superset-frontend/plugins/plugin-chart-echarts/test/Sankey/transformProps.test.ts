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
import { ChartProps, ChartPropsConfig } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import { SankeyChartProps } from '../../src/Sankey/types';
import transformProps, {
  DIMMED_LINK_OPACITY,
  SELECTED_LINK_OPACITY,
} from '../../src/Sankey/transformProps';
import { NULL_STRING, OpacityEnum } from '../../src/constants';
import {
  EMPTY_STRING,
  sankeyNodeKey,
  sankeyValueId,
} from '../../src/Sankey/crossFilter';

const formData = {
  datasource: '1__table',
  viz_type: 'sankey_v2',
  source: 'source',
  target: 'target',
  metric: 'value',
  color_scheme: 'supersetColors',
};

const data = [
  { source: 'A', target: 'B', value: 10 },
  { source: 'B', target: 'C', value: 5 },
  { source: 'D', target: 'E', value: 1 },
  { source: null, target: '', value: 2 },
];

type NodeOption = {
  name: string;
  displayName: string;
  filterColumn: 'source' | 'target';
  rawValue: unknown;
  itemStyle: { opacity?: number };
  label?: { formatter?: () => string };
};

type TooltipParams = {
  name?: string;
  value?: number;
  data?: { source?: string; target?: string };
};

type LinkOption = {
  source: string;
  target: string;
  sourceValue: unknown;
  targetValue: unknown;
  lineStyle?: { opacity?: number };
};

type SankeyTestOptions = {
  series?: {
    cursor?: string;
    data?: NodeOption[];
    links?: LinkOption[];
  };
  tooltip?: {
    formatter?: (params: TooltipParams) => string;
  };
};

function renderChart(
  overrides: Partial<ChartPropsConfig> = {},
): SankeyTestOptions {
  const chartProps = new ChartProps({
    formData,
    width: 800,
    height: 600,
    queriesData: [{ data }],
    theme: supersetTheme,
    ...overrides,
  });
  return transformProps(chartProps as SankeyChartProps)
    .echartOptions as SankeyTestOptions;
}

test('a repeated value keeps the column of the row that introduced it', () => {
  const nodes = renderChart().series?.data ?? [];
  const nodeB = nodes.find(node => node.rawValue === 'B');

  expect(nodeB).toEqual(
    expect.objectContaining({
      name: sankeyValueId('B'),
      displayName: 'B',
      filterColumn: 'target',
      rawValue: 'B',
    }),
  );
  expect(nodes.find(node => node.rawValue === 'A')?.filterColumn).toBe(
    'source',
  );
});

test('null and an empty string stay separate nodes', () => {
  const chart = renderChart();
  const links = chart.series?.links ?? [];
  const nodes = chart.series?.data ?? [];
  const missing = links.find(link => link.sourceValue === null);

  expect(missing?.source).toBe(sankeyValueId(null));
  expect(missing?.target).toBe(sankeyValueId(''));
  expect(missing?.source).not.toBe(sankeyValueId(NULL_STRING));
  expect(missing?.target).not.toBe(sankeyValueId(EMPTY_STRING));
  expect(nodes.find(node => node.rawValue === null)?.displayName).toBe(
    NULL_STRING,
  );
  expect(nodes.find(node => node.rawValue === '')?.displayName).toBe(
    EMPTY_STRING,
  );
});

test('a number and the same bigint are different endpoints', () => {
  const chart = renderChart({
    queriesData: [
      {
        data: [{ source: 42, target: 42n, value: 1 }],
      },
    ],
  });
  const link = chart.series?.links?.[0];

  expect(link?.source).toBe(sankeyValueId(42));
  expect(link?.target).toBe(sankeyValueId(42n));
  expect(link?.source).not.toBe(link?.target);
});

test('selecting a node dims flows outside that column', () => {
  const options = renderChart({
    filterState: { selectedValues: [sankeyNodeKey('target', 'B')] },
    emitCrossFilters: false,
  });
  const nodes = options.series?.data ?? [];
  const links = options.series?.links ?? [];
  const opacityOf = (value: string) =>
    nodes.find(node => node.rawValue === value)?.itemStyle.opacity;

  expect(opacityOf('B')).toBeUndefined();
  expect(opacityOf('A')).toBeUndefined();
  expect(opacityOf('C')).toBe(OpacityEnum.SemiTransparent);
  expect(opacityOf('D')).toBe(OpacityEnum.SemiTransparent);
  expect(links.find(link => link.sourceValue === 'A')?.lineStyle?.opacity).toBe(
    SELECTED_LINK_OPACITY,
  );
  expect(links.find(link => link.targetValue === 'C')?.lineStyle?.opacity).toBe(
    DIMMED_LINK_OPACITY,
  );
  expect(SELECTED_LINK_OPACITY).toBeGreaterThan(DIMMED_LINK_OPACITY);
  expect(options.series?.cursor).toBe('default');
});

test('links keep the default opacity when nothing is selected', () => {
  const links = renderChart().series?.links ?? [];

  expect(links.every(link => link.lineStyle === undefined)).toBe(true);
});

test('the pointer cursor is used when the chart emits cross filters', () => {
  expect(renderChart({ emitCrossFilters: true }).series?.cursor).toBe(
    'pointer',
  );
});

test('labels and tooltips use the display name', () => {
  const chart = renderChart();
  const nodes = chart.series?.data ?? [];
  const links = chart.series?.links ?? [];
  const nodeA = nodes.find(node => node.rawValue === 'A');
  const link = links.find(link => link.sourceValue === 'A');
  const formatter = chart.tooltip?.formatter;
  const linkTip = formatter?.({
    value: 10,
    data: { source: link?.source, target: link?.target },
  });

  expect(nodes.find(node => node.rawValue === null)?.label?.formatter?.()).toBe(
    NULL_STRING,
  );
  expect(linkTip).toContain('A → B');
  expect(linkTip).toContain('% (A)');
  expect(linkTip).toContain('% (B)');
  expect(linkTip).not.toContain(sankeyValueId('A'));
  expect(formatter?.({ name: nodeA?.name, value: 10, data: {} })).toContain(
    'A',
  );
  expect(formatter?.({ name: 'missing', value: 1, data: {} })).toContain(
    'missing',
  );
});

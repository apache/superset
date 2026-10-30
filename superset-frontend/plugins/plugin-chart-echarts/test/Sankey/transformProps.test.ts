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
import transformProps from '../../src/Sankey/transformProps';
import { NULL_STRING, OpacityEnum } from '../../src/constants';
import { EMPTY_STRING, sankeyNodeKey } from '../../src/Sankey/crossFilter';

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
  filterColumn: 'source' | 'target';
  rawValue: unknown;
  itemStyle: { opacity?: number };
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

test('a repeated label keeps the column of the row that introduced it', () => {
  const nodes = renderChart().series?.data ?? [];
  const nodeB = nodes.find(node => node.name === 'B');

  expect(nodeB).toEqual(
    expect.objectContaining({
      filterColumn: 'target',
      rawValue: 'B',
    }),
  );
  expect(nodes.find(node => node.name === 'A')?.filterColumn).toBe('source');
});

test('null and an empty string get distinct node names', () => {
  const links = renderChart().series?.links ?? [];
  const missing = links.find(link => link.sourceValue === null);

  expect(missing?.source).toBe(NULL_STRING);
  expect(missing?.target).toBe(EMPTY_STRING);
  expect(missing?.targetValue).toBe('');
});

test('selecting a node dims flows outside that column', () => {
  const options = renderChart({
    filterState: { selectedValues: [sankeyNodeKey('target', 'B')] },
    emitCrossFilters: false,
  });
  const nodes = options.series?.data ?? [];
  const links = options.series?.links ?? [];
  const opacityOf = (name: string) =>
    nodes.find(node => node.name === name)?.itemStyle.opacity;

  expect(opacityOf('B')).toBeUndefined();
  expect(opacityOf('A')).toBeUndefined();
  expect(opacityOf('C')).toBe(OpacityEnum.SemiTransparent);
  expect(opacityOf('D')).toBe(OpacityEnum.SemiTransparent);
  expect(links.find(link => link.source === 'A')?.lineStyle).toBeUndefined();
  expect(links.find(link => link.target === 'C')?.lineStyle?.opacity).toBe(
    OpacityEnum.SemiTransparent,
  );
  expect(options.series?.cursor).toBe('default');
});

test('the pointer cursor is used when the chart emits cross filters', () => {
  expect(renderChart({ emitCrossFilters: true }).series?.cursor).toBe(
    'pointer',
  );
});

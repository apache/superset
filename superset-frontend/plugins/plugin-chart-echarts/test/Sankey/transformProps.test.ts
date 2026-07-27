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
import { ChartProps, DataRecord } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import type { SankeySeriesOption } from 'echarts/charts';
import transformProps from '../../src/Sankey/transformProps';
import { SankeyChartProps } from '../../src/Sankey/types';

type SankeyNode = { name: string; depth?: number };
type SankeyLink = { source: string; target: string; value: number };

const getSeries = (props: ChartProps): SankeySeriesOption => {
  const { echartOptions } = transformProps(props as SankeyChartProps);
  return (echartOptions as { series: SankeySeriesOption }).series;
};

const getNodes = (props: ChartProps) => getSeries(props).data as SankeyNode[];

const getLinks = (props: ChartProps) => getSeries(props).links as SankeyLink[];

const makeProps = (
  formDataOverrides: Record<string, unknown>,
  data: DataRecord[],
) =>
  new ChartProps({
    formData: {
      colorScheme: 'supersetColors',
      datasource: '1__table',
      metric: 'count',
      source: 'source_col',
      target: 'target_col',
      vizType: 'sankey_v2',
      ...formDataOverrides,
    },
    width: 800,
    height: 600,
    queriesData: [{ data }],
    theme: supersetTheme,
  });

test('two-column mode emits raw pairwise links and node names', () => {
  const props = makeProps({}, [
    { source_col: 'a', target_col: 'b', count: 10 },
    { source_col: 'b', target_col: 'c', count: 5 },
  ]);
  expect(getLinks(props)).toEqual([
    { source: 'a', target: 'b', value: 10 },
    { source: 'b', target: 'c', value: 5 },
  ]);
  const nodes = getNodes(props);
  expect(nodes.map(node => node.name).sort()).toEqual(['a', 'b', 'c']);
  // no level prefixes and no depth pinning: cross-row chaining (a→b→c)
  // must keep working for edge-list datasets
  nodes.forEach(node => expect(node.depth).toBeUndefined());
});

test('three-column mode chains adjacent pairs with level-prefixed names', () => {
  const props = makeProps({ intermediateLevels: ['mid_col'] }, [
    { source_col: 'a', mid_col: 'm', target_col: 'z', count: 10 },
  ]);
  expect(getLinks(props)).toEqual([
    { source: '0\0a', target: '1\0m', value: 10 },
    { source: '1\0m', target: '2\0z', value: 10 },
  ]);
  expect(getNodes(props)).toEqual([
    expect.objectContaining({ name: '0\0a', depth: 0 }),
    expect.objectContaining({ name: '1\0m', depth: 1 }),
    expect.objectContaining({ name: '2\0z', depth: 2 }),
  ]);
});

test('four-column mode aggregates duplicate adjacent pairs across rows', () => {
  const props = makeProps({ intermediateLevels: ['mid_1', 'mid_2'] }, [
    { source_col: 'a', mid_1: 'm', mid_2: 'n', target_col: 'z', count: 10 },
    { source_col: 'b', mid_1: 'm', mid_2: 'n', target_col: 'z', count: 5 },
  ]);
  const links = getLinks(props);
  expect(links).toHaveLength(4);
  expect(links).toContainEqual({ source: '1\0m', target: '2\0n', value: 15 });
  expect(links).toContainEqual({ source: '2\0n', target: '3\0z', value: 15 });
});

test('null intermediate values coalesce to NULL_STRING and preserve totals', () => {
  const props = makeProps({ intermediateLevels: ['mid_col'] }, [
    { source_col: 'a', mid_col: null, target_col: 'z', count: 10 },
  ]);
  expect(getLinks(props)).toEqual([
    { source: '0\0a', target: '1\0<NULL>', value: 10 },
    { source: '1\0<NULL>', target: '2\0z', value: 10 },
  ]);
});

test('the same value in different levels creates distinct nodes', () => {
  const props = makeProps({ intermediateLevels: ['mid_col'] }, [
    { source_col: 'direct', mid_col: 'x', target_col: 'direct', count: 10 },
  ]);
  const names = getNodes(props).map(node => node.name);
  expect(names).toContain('0\0direct');
  expect(names).toContain('2\0direct');
});

test('the same value in adjacent levels does not create a self-loop', () => {
  const props = makeProps({ intermediateLevels: ['mid_col'] }, [
    { source_col: 'x', mid_col: 'x', target_col: 'z', count: 10 },
  ]);
  const links = getLinks(props);
  expect(links).toContainEqual({ source: '0\0x', target: '1\0x', value: 10 });
  links.forEach(link => expect(link.source).not.toEqual(link.target));
});

test('label formatter strips the level prefix in multi-level mode', () => {
  const props = makeProps({ intermediateLevels: ['mid_col'] }, [
    { source_col: 'a', mid_col: 'm', target_col: 'z', count: 10 },
  ]);
  const { label } = getSeries(props);
  const formatter = label?.formatter as (params: { name: string }) => string;
  expect(formatter({ name: '1\0m' })).toEqual('m');
});

test('label formatter is an identity for two-column mode', () => {
  const props = makeProps({}, [
    { source_col: 'a', target_col: 'b', count: 10 },
  ]);
  const { label } = getSeries(props);
  const formatter = label?.formatter as (params: { name: string }) => string;
  expect(formatter({ name: 'a' })).toEqual('a');
});

// ECharts spends nodeGap as a fixed pixel budget per column, so a large value
// makes it drop every node once gaps exceed the canvas height (33 nodes at
// nodeGap 20 renders nothing below 800px tall). Keep the default.
test('nodeGap is left at the ECharts default', () => {
  const series = getSeries(
    makeProps({}, [{ source_col: 'a', target_col: 'b', count: 10 }]),
  );
  expect(series.nodeGap).toBeUndefined();
});

test('labels are truncated to a fixed width so flows keep their space', () => {
  const { label } = getSeries(
    makeProps({}, [{ source_col: 'a', target_col: 'b', count: 10 }]),
  );
  expect(label?.width).toBeGreaterThan(0);
  expect(label?.overflow).toEqual('truncate');
});

test('roam is enabled by default and honors the form data value', () => {
  const data = [{ source_col: 'a', target_col: 'b', count: 10 }];
  expect(getSeries(makeProps({}, data)).roam).toBe(true);
  expect(getSeries(makeProps({ roam: 'move' }, data)).roam).toEqual('move');
  expect(getSeries(makeProps({ roam: false }, data)).roam).toBe(false);
});

test('nodeAlign defaults to justify and honors the form data value', () => {
  const data = [{ source_col: 'a', target_col: 'b', count: 10 }];
  expect(getSeries(makeProps({}, data)).nodeAlign).toEqual('justify');
  expect(
    getSeries(makeProps({ nodeAlignment: 'left' }, data)).nodeAlign,
  ).toEqual('left');
});

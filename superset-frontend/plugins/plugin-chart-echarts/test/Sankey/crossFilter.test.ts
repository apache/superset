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
import { NULL_STRING } from '../../src/constants';
import {
  EMPTY_STRING,
  getSankeyCrossFilterDataMask,
  getSankeyDrillFilters,
  isSankeyLinkDimmed,
  isSankeyNodeDimmed,
  sankeyLinkKey,
  sankeyNodeKey,
  sankeyNodeName,
  SankeyLinkDatum,
  SankeyNodeDatum,
} from '../../src/Sankey/crossFilter';

const source = 'source';
const target = 'target';

const nodeA: SankeyNodeDatum = {
  name: 'A',
  filterColumn: 'source',
  rawValue: 'A',
};

const linkAB: SankeyLinkDatum = {
  source: 'A',
  target: 'B',
  value: 10,
  sourceValue: 'A',
  targetValue: 'B',
};

test('node names keep null and an empty string distinct', () => {
  expect(sankeyNodeName(null)).toBe(NULL_STRING);
  expect(sankeyNodeName('')).toBe(EMPTY_STRING);
  expect(sankeyNodeName(42n)).toBe('42');
  expect(sankeyNodeName(2024)).toBe('2024');
});

test('a node click filters the column that introduced the label', () => {
  const mask = getSankeyCrossFilterDataMask({
    source,
    target,
    datum: nodeA,
    selectedKeys: [],
  });

  expect(mask.isCurrentValueSelected).toBe(false);
  expect(mask.dataMask).toEqual({
    extraFormData: {
      filters: [{ col: 'source', op: 'IN', val: ['A'] }],
    },
    filterState: {
      label: 'A',
      value: 'A',
      selectedValues: [sankeyNodeKey('source', 'A')],
    },
  });
});

test('a second click on the same node clears the filter', () => {
  const mask = getSankeyCrossFilterDataMask({
    source,
    target,
    datum: nodeA,
    selectedKeys: [sankeyNodeKey('source', 'A')],
  });

  expect(mask.isCurrentValueSelected).toBe(true);
  expect(mask.dataMask.extraFormData.filters).toEqual([]);
  expect(mask.dataMask.filterState.selectedValues).toBeNull();
});

test('a link click filters source and target together', () => {
  const mask = getSankeyCrossFilterDataMask({
    source,
    target,
    datum: linkAB,
    selectedKeys: [],
  });

  expect(mask.dataMask.extraFormData.filters).toEqual([
    { col: 'source', op: 'IN', val: ['A'] },
    { col: 'target', op: 'IN', val: ['B'] },
  ]);
  expect(mask.dataMask.filterState).toEqual({
    label: 'A → B',
    value: 'A → B',
    selectedValues: [sankeyLinkKey('A', 'B')],
  });
});

test('null becomes IS NULL and an empty string stays an empty value', () => {
  const nullNode: SankeyNodeDatum = {
    name: NULL_STRING,
    filterColumn: 'target',
    rawValue: null,
  };
  const emptyLink: SankeyLinkDatum = {
    source: 'A',
    target: EMPTY_STRING,
    value: 1,
    sourceValue: 'A',
    targetValue: '',
  };

  expect(
    getSankeyCrossFilterDataMask({
      source,
      target,
      datum: nullNode,
      selectedKeys: [],
    }).dataMask.extraFormData.filters,
  ).toEqual([{ col: 'target', op: 'IS NULL' }]);
  expect(
    getSankeyCrossFilterDataMask({
      source,
      target,
      datum: emptyLink,
      selectedKeys: [],
    }).dataMask.extraFormData.filters,
  ).toEqual([
    { col: 'source', op: 'IN', val: ['A'] },
    { col: 'target', op: 'IN', val: [''] },
  ]);
});

test('a bigint filter value is serialized as a string', () => {
  const node: SankeyNodeDatum = {
    name: '42',
    filterColumn: 'source',
    rawValue: 42n,
  };

  expect(
    getSankeyCrossFilterDataMask({
      source,
      target,
      datum: node,
      selectedKeys: [],
    }).dataMask.extraFormData.filters,
  ).toEqual([{ col: 'source', op: 'IN', val: ['42'] }]);
});

test('drill filters use equality and keep null distinct', () => {
  expect(getSankeyDrillFilters(source, target, linkAB)).toEqual([
    { col: 'source', op: '==', val: 'A', formattedVal: 'A' },
    { col: 'target', op: '==', val: 'B', formattedVal: 'B' },
  ]);
  expect(
    getSankeyDrillFilters(source, target, {
      name: NULL_STRING,
      filterColumn: 'source',
      rawValue: null,
    }),
  ).toEqual([{ col: 'source', op: 'IS NULL', formattedVal: NULL_STRING }]);
});

test('a selected node keeps its matching flows and their other ends', () => {
  const links = [
    { source: 'A', target: 'B' },
    { source: 'B', target: 'C' },
    { source: 'D', target: 'E' },
  ];
  const keys = [sankeyNodeKey('target', 'B')];

  expect(isSankeyNodeDimmed('B', keys, links)).toBe(false);
  expect(isSankeyNodeDimmed('A', keys, links)).toBe(false);
  expect(isSankeyNodeDimmed('C', keys, links)).toBe(true);
  expect(isSankeyLinkDimmed(links[0], keys)).toBe(false);
  expect(isSankeyLinkDimmed(links[1], keys)).toBe(true);
  expect(isSankeyLinkDimmed(links[2], keys)).toBe(true);
});

test('a selected link keeps only that link and its endpoints', () => {
  const links = [
    { source: 'A', target: 'B' },
    { source: 'B', target: 'C' },
  ];
  const keys = [sankeyLinkKey('B', 'C')];

  expect(isSankeyLinkDimmed(links[1], keys)).toBe(false);
  expect(isSankeyLinkDimmed(links[0], keys)).toBe(true);
  expect(isSankeyNodeDimmed('B', keys, links)).toBe(false);
  expect(isSankeyNodeDimmed('C', keys, links)).toBe(false);
  expect(isSankeyNodeDimmed('A', keys, links)).toBe(true);
});

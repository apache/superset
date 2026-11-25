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
  getSankeyHighlight,
  getSelectedSankeyKeys,
  sankeyEndpointKey,
  sankeyLinkKey,
  sankeyNodeKey,
  sankeyNodeName,
  sankeyValueId,
  SankeyLinkDatum,
  SankeyNodeDatum,
} from '../../src/Sankey/crossFilter';

const source = 'source';
const target = 'target';

const nodeA: SankeyNodeDatum = {
  name: sankeyValueId('A'),
  displayName: 'A',
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

test('value ids do not collapse labels that look the same', () => {
  const date = new Date('2021-01-01T00:00:00.000Z');

  expect(sankeyValueId(null)).not.toBe(sankeyValueId(NULL_STRING));
  expect(sankeyValueId('')).not.toBe(sankeyValueId(EMPTY_STRING));
  expect(sankeyValueId(42)).not.toBe(sankeyValueId(42n));
  expect(sankeyValueId(42n)).not.toBe(sankeyValueId('42'));
  expect(sankeyValueId(date)).toBe(
    JSON.stringify({ date: '2021-01-01T00:00:00.000Z' }),
  );
  expect(sankeyValueId(date)).not.toBe(sankeyValueId(date.toISOString()));
  expect(sankeyNodeKey('source', 42)).not.toBe(sankeyNodeKey('source', 42n));
  expect(sankeyLinkKey(42, '42')).not.toBe(sankeyLinkKey(42, 42));
});

test('selected values stored as an object are read as keys', () => {
  const key = sankeyNodeKey('source', 'A');

  expect(getSelectedSankeyKeys({ first: key, second: key })).toEqual([
    key,
    key,
  ]);
  expect(getSelectedSankeyKeys(1)).toEqual([]);
  expect(getSelectedSankeyKeys(null)).toEqual([]);
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
    name: sankeyValueId(null),
    displayName: NULL_STRING,
    filterColumn: 'target',
    rawValue: null,
  };
  const emptyLink: SankeyLinkDatum = {
    source: sankeyValueId('A'),
    target: sankeyValueId(''),
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
    name: sankeyValueId(42n),
    displayName: '42',
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
      name: sankeyValueId(null),
      displayName: NULL_STRING,
      filterColumn: 'source',
      rawValue: null,
    }),
  ).toEqual([{ col: 'source', op: 'IS NULL', formattedVal: NULL_STRING }]);
});

test('a selected node keeps its matching flows and their other ends', () => {
  const a = sankeyValueId('A');
  const b = sankeyValueId('B');
  const c = sankeyValueId('C');
  const d = sankeyValueId('D');
  const e = sankeyValueId('E');
  const links = [
    { source: a, target: b },
    { source: b, target: c },
    { source: d, target: e },
  ];
  const highlight = getSankeyHighlight([sankeyNodeKey('target', 'B')], links);

  expect(highlight?.nodeIds.has(b)).toBe(true);
  expect(highlight?.nodeIds.has(a)).toBe(true);
  expect(highlight?.nodeIds.has(c)).toBe(false);
  expect(highlight?.linkKeys.has(sankeyEndpointKey(a, b))).toBe(true);
  expect(highlight?.linkKeys.has(sankeyEndpointKey(b, c))).toBe(false);
  expect(highlight?.linkKeys.has(sankeyEndpointKey(d, e))).toBe(false);
});

test('several flows through one node stay indexed', () => {
  const a = sankeyValueId('A');
  const b = sankeyValueId('B');
  const c = sankeyValueId('C');
  const links = [
    { source: a, target: b },
    { source: a, target: c },
    { source: b, target: c },
  ];
  const highlight = getSankeyHighlight([sankeyNodeKey('source', 'A')], links);

  expect(highlight?.linkKeys.has(sankeyEndpointKey(a, b))).toBe(true);
  expect(highlight?.linkKeys.has(sankeyEndpointKey(a, c))).toBe(true);
  expect(highlight?.linkKeys.has(sankeyEndpointKey(b, c))).toBe(false);
  expect(highlight?.nodeIds.has(b)).toBe(true);
  expect(highlight?.nodeIds.has(c)).toBe(true);
});

test('a broken selection key highlights nothing', () => {
  const a = sankeyValueId('A');
  const b = sankeyValueId('B');
  const highlight = getSankeyHighlight(
    ['not-json', JSON.stringify({ bad: true }), JSON.stringify(['nope'])],
    [{ source: a, target: b }],
  );

  expect(highlight?.nodeIds.size).toBe(0);
  expect(highlight?.linkKeys.size).toBe(0);
});

test('a selected link keeps only that link and its endpoints', () => {
  const a = sankeyValueId('A');
  const b = sankeyValueId('B');
  const c = sankeyValueId('C');
  const links = [
    { source: a, target: b },
    { source: b, target: c },
  ];
  const highlight = getSankeyHighlight([sankeyLinkKey('B', 'C')], links);

  expect(highlight?.linkKeys.has(sankeyEndpointKey(b, c))).toBe(true);
  expect(highlight?.linkKeys.has(sankeyEndpointKey(a, b))).toBe(false);
  expect(highlight?.nodeIds.has(b)).toBe(true);
  expect(highlight?.nodeIds.has(c)).toBe(true);
  expect(highlight?.nodeIds.has(a)).toBe(false);
});

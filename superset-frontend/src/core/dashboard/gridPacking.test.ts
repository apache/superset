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
import type { dashboard as dashboardApi } from '@apache-superset/core';
import { packChildLayout, resolveExplicitCollisions } from './gridPacking';

type DashboardNode = dashboardApi.DashboardNode;

function nodeMap(nodes: Record<string, Partial<DashboardNode>>) {
  return (id: string) =>
    nodes[id] ? ({ id, ...nodes[id] } as DashboardNode) : undefined;
}

test('auto-places children top-to-bottom, left-to-right in order, wrapping at the column count', () => {
  const getNode = nodeMap({
    a: { layout: { colSpan: 12 } },
    b: { layout: { colSpan: 6 } },
    c: { layout: { colSpan: 6 } },
    d: { layout: { colSpan: 12 } },
  });

  expect(packChildLayout(['a', 'b', 'c', 'd'], 24, getNode)).toEqual({
    a: { x: 0, y: 0, w: 12, h: 1 },
    b: { x: 12, y: 0, w: 6, h: 1 },
    c: { x: 18, y: 0, w: 6, h: 1 },
    d: { x: 0, y: 1, w: 12, h: 1 },
  });
});

test('defaults an omitted colSpan to the full column count and rowSpan to 1', () => {
  const getNode = nodeMap({ a: {}, b: {} });

  expect(packChildLayout(['a', 'b'], 24, getNode)).toEqual({
    a: { x: 0, y: 0, w: 24, h: 1 },
    b: { x: 0, y: 1, w: 24, h: 1 },
  });
});

test('reserves cells for explicitly placed children before auto-placing the rest', () => {
  const getNode = nodeMap({
    hero: { layout: { col: 1, row: 1, colSpan: 8, rowSpan: 2 } },
    auto: { layout: { colSpan: 4 } },
  });

  expect(packChildLayout(['hero', 'auto'], 24, getNode)).toEqual({
    hero: { x: 0, y: 0, w: 8, h: 2 },
    auto: { x: 8, y: 0, w: 4, h: 1 },
  });
});

test('auto-placed children flow around an explicitly placed obstacle', () => {
  const getNode = nodeMap({
    badge: { layout: { col: 1, row: 1, colSpan: 24 } },
    auto: { layout: { colSpan: 24 } },
  });

  expect(packChildLayout(['badge', 'auto'], 24, getNode)).toEqual({
    badge: { x: 0, y: 0, w: 24, h: 1 },
    auto: { x: 0, y: 1, w: 24, h: 1 },
  });
});

test('clamps a colSpan wider than the container to the column count', () => {
  const getNode = nodeMap({ a: { layout: { colSpan: 99 } } });

  expect(packChildLayout(['a'], 24, getNode)).toEqual({
    a: { x: 0, y: 0, w: 24, h: 1 },
  });
});

test('resolveExplicitCollisions leaves non-colliding explicit children untouched', () => {
  const getNode = nodeMap({
    a: { layout: { col: 1, row: 1, colSpan: 12 } },
    b: { layout: { col: 13, row: 1, colSpan: 12 } },
  });

  expect(resolveExplicitCollisions(['a', 'b'], 24, getNode)).toEqual({});
});

test('resolveExplicitCollisions ignores auto-placed children entirely', () => {
  const getNode = nodeMap({
    a: { layout: { col: 1, row: 1, colSpan: 24 } },
    auto: { layout: { colSpan: 24 } },
  });

  expect(resolveExplicitCollisions(['a', 'auto'], 24, getNode)).toEqual({});
});

test('resolveExplicitCollisions pushes a later, colliding explicit child straight down', () => {
  const getNode = nodeMap({
    first: { layout: { col: 1, row: 1, colSpan: 24 } },
    second: { layout: { col: 1, row: 1, colSpan: 24 } },
  });

  expect(resolveExplicitCollisions(['first', 'second'], 24, getNode)).toEqual({
    second: { col: 1, row: 2 },
  });
});

test('resolveExplicitCollisions cascades past every already-placed row it still overlaps', () => {
  const getNode = nodeMap({
    first: { layout: { col: 1, row: 1, colSpan: 24 } },
    second: { layout: { col: 1, row: 2, colSpan: 24 } },
    third: { layout: { col: 1, row: 1, colSpan: 24 } },
  });

  expect(
    resolveExplicitCollisions(['first', 'second', 'third'], 24, getNode),
  ).toEqual({
    third: { col: 1, row: 3 },
  });
});

test('resolveExplicitCollisions does not move an explicit child whose column only overlaps a different row', () => {
  const getNode = nodeMap({
    a: { layout: { col: 1, row: 1, colSpan: 12 } },
    b: { layout: { col: 1, row: 2, colSpan: 6 } },
  });

  expect(resolveExplicitCollisions(['a', 'b'], 24, getNode)).toEqual({});
});

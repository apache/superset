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
import {
  availableDropSpan,
  buildOccupancy,
  cellKey,
  packChildLayout,
  resolveDropPlacement,
  resolveExplicitCollisions,
  type PackedRect,
} from './gridPacking';

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

test('cellKey is the same string two equal coordinates produce', () => {
  expect(cellKey(3, 5)).toBe(cellKey(3, 5));
  expect(cellKey(3, 5)).not.toBe(cellKey(5, 3));
});

test('buildOccupancy records which node owns every cell a rect spans', () => {
  const packed: Record<string, PackedRect> = {
    a: { x: 0, y: 0, w: 2, h: 2 },
    b: { x: 2, y: 0, w: 1, h: 1 },
  };

  const occupancy = buildOccupancy(packed);

  expect(occupancy.get(cellKey(0, 0))).toBe('a');
  expect(occupancy.get(cellKey(1, 1))).toBe('a');
  expect(occupancy.get(cellKey(2, 0))).toBe('b');
  expect(occupancy.get(cellKey(2, 1))).toBeUndefined();
});

test('buildOccupancy is empty for an empty grid', () => {
  expect(buildOccupancy({})).toEqual(new Map());
});

test('availableDropSpan caps width at maxColSpan on a wholly empty grid, so a drop there is not forced full-width', () => {
  // Regression: before `maxColSpan` existed, an empty grid had nothing
  // anywhere to bound a free run, so "open space" always meant "the whole
  // row" — the ghost (and the widget it produced) ignored the cursor's own
  // column entirely. Growth is still left-first, so a cursor this far from
  // the left edge exhausts the cap before reaching it.
  expect(availableDropSpan({}, 24, 10, 3, 6, 12)).toEqual({
    x: 0,
    y: 3,
    w: 12,
    h: 6,
  });
});

test('availableDropSpan bounds a free run by the nearest occupied cells on either side, even under a cap wide enough to matter', () => {
  const packed: Record<string, PackedRect> = {
    left: { x: 0, y: 0, w: 6, h: 1 },
    right: { x: 18, y: 0, w: 6, h: 1 },
  };

  expect(availableDropSpan(packed, 24, 10, 0, 6, 24)).toEqual({
    x: 6,
    y: 0,
    w: 12,
    h: 6,
  });
});

test('availableDropSpan anchors at the run start even when the cursor sits at the run end', () => {
  // Regression: the run [6, 17] is free either way, but before this fixed a
  // cursor near its right end returned a rect starting at the cursor's own
  // column instead of the run's — wider than the space actually to its right.
  const packed: Record<string, PackedRect> = {
    left: { x: 0, y: 0, w: 6, h: 1 },
    right: { x: 18, y: 0, w: 6, h: 1 },
  };

  expect(availableDropSpan(packed, 24, 17, 0, 6, 24)).toEqual({
    x: 6,
    y: 0,
    w: 12,
    h: 6,
  });
});

test('availableDropSpan caps height at maxRowSpan even when more rows are free', () => {
  expect(availableDropSpan({}, 24, 0, 0, 4, 24)).toEqual({
    x: 0,
    y: 0,
    w: 24,
    h: 4,
  });
});

test('availableDropSpan stops growing height at the first occupied row below', () => {
  const packed: Record<string, PackedRect> = {
    blocker: { x: 0, y: 3, w: 24, h: 1 },
  };

  expect(availableDropSpan(packed, 24, 0, 0, 6, 24)).toEqual({
    x: 0,
    y: 0,
    w: 24,
    h: 3,
  });
});

test('availableDropSpan over an occupied cell returns the full row, uncapped by maxColSpan', () => {
  const packed: Record<string, PackedRect> = {
    a: { x: 0, y: 0, w: 24, h: 2 },
  };

  // maxColSpan(4) is deliberately narrower than the grid: this band means
  // "insert a full-width row here", not "drop a widget here", so it stays
  // uncapped regardless.
  expect(availableDropSpan(packed, 24, 5, 1, 6, 4)).toEqual({
    x: 0,
    y: 1,
    w: 24,
    h: 6,
  });
});

test('resolveDropPlacement over open space delegates to availableDropSpan', () => {
  const packed: Record<string, PackedRect> = {
    a: { x: 0, y: 0, w: 12, h: 2 },
  };

  expect(resolveDropPlacement(packed, 24, 15, 0.5, 6, 24)).toEqual({
    rect: availableDropSpan(packed, 24, 15, 0, 6, 24),
  });
});

test('resolveDropPlacement in the top band of a widget inserts a full-width row above it', () => {
  const packed: Record<string, PackedRect> = {
    target: { x: 4, y: 2, w: 12, h: 8 },
  };

  // fracY = (2.5 - 2) / 8 = 0.0625, inside the top 25% band.
  expect(resolveDropPlacement(packed, 24, 10, 2.5, 6, 12)).toEqual({
    rect: { x: 0, y: 2, w: 24, h: 6 },
  });
});

test('resolveDropPlacement in the bottom band of a widget inserts a full-width row below it', () => {
  const packed: Record<string, PackedRect> = {
    target: { x: 4, y: 2, w: 12, h: 8 },
  };

  // fracY = (9.5 - 2) / 8 = 0.9375, inside the bottom 25% band.
  expect(resolveDropPlacement(packed, 24, 10, 9.5, 6, 12)).toEqual({
    rect: { x: 0, y: 10, w: 24, h: 6 },
  });
});

test('resolveDropPlacement in the middle band, left of center, splits the widget and shrinks it to the right half', () => {
  const packed: Record<string, PackedRect> = {
    target: { x: 0, y: 0, w: 24, h: 4 },
  };

  // fracY = 0.5, in the middle band; exactCol 6 is left of the widget's own
  // midpoint (12).
  expect(resolveDropPlacement(packed, 24, 6, 2, 6, 12)).toEqual({
    rect: { x: 0, y: 0, w: 12, h: 4 },
    shrink: { id: 'target', rect: { x: 12, y: 0, w: 12, h: 4 } },
  });
});

test('resolveDropPlacement in the middle band, right of center, splits the widget and shrinks it to the left half', () => {
  const packed: Record<string, PackedRect> = {
    target: { x: 0, y: 0, w: 24, h: 4 },
  };

  expect(resolveDropPlacement(packed, 24, 18, 2, 6, 12)).toEqual({
    rect: { x: 12, y: 0, w: 12, h: 4 },
    shrink: { id: 'target', rect: { x: 0, y: 0, w: 12, h: 4 } },
  });
});

test('resolveDropPlacement gives the odd leftover column to whichever half keeps it', () => {
  const packed: Record<string, PackedRect> = {
    target: { x: 0, y: 0, w: 5, h: 2 },
  };

  // w=5 -> newW = floor(5/2) = 2, keepW = 3. exactCol 1 is left of the
  // midpoint (2.5), so the new widget takes the narrower half.
  expect(resolveDropPlacement(packed, 24, 1, 1, 6, 12)).toEqual({
    rect: { x: 0, y: 0, w: 2, h: 2 },
    shrink: { id: 'target', rect: { x: 2, y: 0, w: 3, h: 2 } },
  });
});

test('resolveDropPlacement refuses to split a widget narrower than the minimum, falling back to the nearer edge', () => {
  const packed: Record<string, PackedRect> = {
    target: { x: 0, y: 0, w: 3, h: 2 },
  };

  // fracY = (0.6 - 0) / 2 = 0.3 is in the middle band (not within
  // EDGE_BAND_FRACTION of either edge), but w=3 is below MIN_SPLIT_COLUMNS —
  // falls back to the nearer edge, and 0.3 is nearer the top.
  expect(resolveDropPlacement(packed, 24, 1, 0.6, 6, 12)).toEqual({
    rect: { x: 0, y: 0, w: 24, h: 6 },
  });
});

test('resolveDropPlacement never produces a shrink that overlaps an unrelated sibling', () => {
  const packed: Record<string, PackedRect> = {
    target: { x: 0, y: 0, w: 24, h: 4 },
    below: { x: 0, y: 4, w: 24, h: 2 },
  };

  const { rect, shrink } = resolveDropPlacement(packed, 24, 6, 2, 6, 12);
  const overlapsBelow = (r: PackedRect): boolean =>
    r.y < packed.below.y + packed.below.h && packed.below.y < r.y + r.h;

  expect(overlapsBelow(rect)).toBe(false);
  expect(shrink && overlapsBelow(shrink.rect)).toBe(false);
});

test('availableDropSpan follows the cursor within a capped, wide-open run rather than anchoring to a fixed edge', () => {
  // No neighbors anywhere in this row: the only bound on either side is
  // maxColSpan itself. A cursor near the grid's own right edge should still
  // produce a rect near the cursor, not one stuck at column 0.
  expect(availableDropSpan({}, 24, 20, 0, 6, 12)).toEqual({
    x: 9,
    y: 0,
    w: 12,
    h: 6,
  });
});

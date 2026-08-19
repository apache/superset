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

type DashboardNode = dashboardApi.DashboardNode;

/** A child's resolved position/size, in the grid's own 0-based coordinate convention (shared by every grid engine this module has fed — react-grid-layout and GridStack alike). */
export interface PackedRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The occupancy-map key for a single cell — shared by every function below that needs to test or record one, so they all agree on the same convention. */
export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * Which node, if any, occupies each cell of `packed` — a lookup `availableDropSpan`
 * needs only as a yes/no test, but `resolveDropPlacement` needs to know *which*
 * widget a drop point falls inside, to find that widget's own edges. Built fresh
 * from `packed` rather than threaded through as its own parameter, since every
 * caller already has `packed` to build it from.
 */
export function buildOccupancy(
  packed: Record<string, PackedRect>,
): Map<string, string> {
  const occupancy = new Map<string, string>();
  Object.entries(packed).forEach(([id, rect]) => {
    for (let dy = 0; dy < rect.h; dy += 1) {
      for (let dx = 0; dx < rect.w; dx += 1) {
        occupancy.set(cellKey(rect.x + dx, rect.y + dy), id);
      }
    }
  });
  return occupancy;
}

/**
 * Resolves a definite `{x, y, w, h}` for every child of a container, given
 * only each child's own `layout` — which, per the dashboard schema, may omit
 * `col`/`row` entirely to request auto-placement. The grid engine underneath
 * has no "auto" position of its own; every item it's given needs concrete
 * coordinates, so this is the one-time translation from "no position
 * specified" to "here's where that currently lands."
 *
 * This runs fresh on every render from the stored layout rather than being
 * persisted: a node stays auto-placed, and keeps reflowing around whatever
 * its siblings are doing, until something actually moves *it* (a drag, or a
 * resize elsewhere that displaces it) — at which point the caller persists
 * an explicit `col`/`row` for that one node.
 *
 * Explicitly placed children reserve their cells first; auto-placed ones
 * fill the next open run of cells that fits their span, scanning
 * top-to-bottom, left-to-right, in `children` order — the same order that
 * governs reading/DOM/tab order, and the same shape a single-column flow's
 * own top-to-bottom auto-placement produces.
 */
export function packChildLayout(
  children: readonly string[],
  columns: number,
  getNode: (id: string) => DashboardNode | undefined,
): Record<string, PackedRect> {
  const occupied = new Set<string>();
  const result: Record<string, PackedRect> = {};

  const occupy = (x: number, y: number, w: number, h: number) => {
    for (let dy = 0; dy < h; dy += 1) {
      for (let dx = 0; dx < w; dx += 1) {
        occupied.add(cellKey(x + dx, y + dy));
      }
    }
  };

  const fits = (x: number, y: number, w: number, h: number) => {
    if (x + w > columns) return false;
    for (let dy = 0; dy < h; dy += 1) {
      for (let dx = 0; dx < w; dx += 1) {
        if (occupied.has(cellKey(x + dx, y + dy))) return false;
      }
    }
    return true;
  };

  const autoPlaced: { id: string; w: number; h: number }[] = [];

  children.forEach(id => {
    const layout = getNode(id)?.layout;
    const w = Math.min(layout?.colSpan ?? columns, columns);
    const h = layout?.rowSpan ?? 1;
    if (layout?.col != null && layout?.row != null) {
      const x = layout.col - 1;
      const y = layout.row - 1;
      result[id] = { x, y, w, h };
      occupy(x, y, w, h);
    } else {
      autoPlaced.push({ id, w, h });
    }
  });

  autoPlaced.forEach(({ id, w, h }) => {
    let y = 0;
    let placed = false;
    while (!placed) {
      for (let x = 0; x <= columns - w; x += 1) {
        if (fits(x, y, w, h)) {
          result[id] = { x, y, w, h };
          occupy(x, y, w, h);
          placed = true;
          break;
        }
      }
      y += 1;
    }
  });

  return result;
}

/**
 * How big a widget being dropped in at `(cursorCol, cursorRow)` has room for
 * — up to `maxRowSpan` tall — given `packed`'s existing occupancy: the pure
 * geometry half of `RootGrid`'s own live drop preview, split out here so it
 * can be exercised without a real drag gesture, the same reason
 * `packChildLayout`'s own placement math lives here rather than inside a
 * component. The one entry point that actually decides between this ("land
 * in whatever's already free") and a left/right split of an existing widget
 * is `resolveDropPlacement`, below, which calls this for its own "open
 * space" case.
 *
 * Open space returns exactly as wide a span as that row has free, capped at
 * `columns` and at `maxColSpan` — a wholly empty grid included, since
 * nothing anywhere is occupied there either, and without the second cap an
 * empty (or otherwise wide-open) grid would offer a full-width widget as the
 * *only* size a drop could ever produce there, regardless of where the
 * cursor actually is. Growth is left-first, same as it was before
 * `maxColSpan` existed, with the cap folded into each step rather than
 * applied after the fact, so a cursor near either true edge of a bounded
 * free run still lands next to that edge instead of centering blindly and
 * spilling past it. Height grows exactly as tall a span as the rows below
 * it, within that same width, stay just as free, capped at `maxRowSpan`. A
 * gap that turns out to be as tall as it is wide is not pushing anything
 * out of the way at all: it was already free on every side. No minimum
 * width of its own beyond that: every widget's own minimum width is 1
 * column, so a single free column is already as legitimate a place to drop
 * one as a whole free row is — narrower than that and there is no width
 * left to report at all. The returned rect's own `x` is the free run's own
 * left edge, not the cursor's column — a cursor near the right end of a
 * free run would otherwise get a preview wider than the space actually to
 * its right.
 *
 * Directly over another widget there is no *beside* to speak of here, only
 * *above* or *below* it (resolved by vertical collision-avoidance the same
 * way repositioning an existing widget already is), so that returns the full
 * row at `maxRowSpan` instead — deliberately not capped by `maxColSpan`:
 * that band means "insert a full-width row here", not "drop a widget here".
 */
export function availableDropSpan(
  packed: Record<string, PackedRect>,
  columns: number,
  cursorCol: number,
  cursorRow: number,
  maxRowSpan: number,
  maxColSpan: number,
): PackedRect {
  const occupancy = buildOccupancy(packed);
  const isOccupied = (x: number, y: number): boolean =>
    occupancy.has(cellKey(x, y));

  if (isOccupied(cursorCol, cursorRow)) {
    return { x: 0, y: cursorRow, w: columns, h: maxRowSpan };
  }

  let left = cursorCol;
  let right = cursorCol;
  while (
    left > 0 &&
    !isOccupied(left - 1, cursorRow) &&
    right - (left - 1) + 1 <= maxColSpan
  ) {
    left -= 1;
  }
  while (
    right < columns - 1 &&
    !isOccupied(right + 1, cursorRow) &&
    right + 1 - left + 1 <= maxColSpan
  ) {
    right += 1;
  }
  const w = right - left + 1;

  const rowIsFree = (row: number): boolean => {
    for (let dx = 0; dx < w; dx += 1) {
      if (isOccupied(left + dx, row)) return false;
    }
    return true;
  };
  let bottom = cursorRow;
  while (bottom - cursorRow + 1 < maxRowSpan && rowIsFree(bottom + 1)) {
    bottom += 1;
  }
  const h = bottom - cursorRow + 1;

  return { x: left, y: cursorRow, w, h };
}

/**
 * How far in from each edge of an occupied widget's own height a drop still
 * reads as "insert a full-width row above/below it" rather than "split it
 * left/right" — the band `resolveDropPlacement` checks before considering a
 * split at all, so that inserting a full-width row between two existing
 * widgets stays reachable once splitting exists (without it, *any* drop onto
 * a widget would try to split it, and there would be no way left to ask for
 * a plain row above or below one).
 */
const EDGE_BAND_FRACTION = 0.25;

/**
 * How many columns a widget must span before splitting it is worth
 * offering. `resolveDropPlacement` halves a target's width with
 * `Math.floor(w / 2)`; below this, one of the two resulting halves would be
 * a sliver too thin to be its own widget — narrower than this and the drop
 * falls back to the same nearer-edge full-row behavior a top/bottom-band
 * drop already gets.
 */
const MIN_SPLIT_COLUMNS = 4;

/**
 * What a drop resolves to: the new widget's own rect, and — only when it
 * lands as a left/right split of an existing widget — that widget's own
 * shrunk rect. `RootGrid`'s own live preview and its actual drop handler
 * both call `resolveDropPlacement` with the same inputs, so what an author
 * sees while hovering is provably what they get on release.
 */
export interface DropPlacement {
  rect: PackedRect;
  shrink?: { id: string; rect: PackedRect };
}

/**
 * Resolves a drop at the cursor's own fractional position — `exactCol`/
 * `exactRow`, not yet floored to a cell, since a left/right split needs the
 * fraction to tell which half of the target widget the cursor is actually
 * nearer to, not just which cell it's over.
 *
 * Landing in open space delegates entirely to `availableDropSpan`, above —
 * unchanged from before this function existed. Landing on an existing
 * widget is otherwise a plain insert (`compactType`-style push, the same
 * "displace, never overlap" rule `resolveExplicitCollisions` already
 * enforces) within `EDGE_BAND_FRACTION` of its top or bottom edge, or a
 * split — new widget takes whichever half of the *widget's own* width
 * (`target.x + target.w / 2`, not the cell the cursor happens to be over)
 * it's nearer to, spanning the target's exact row range; the target shrinks
 * to the other half, keeping whichever side has the odd leftover column —
 * everywhere in between.
 *
 * A split result is collision-free by construction: the new widget only
 * ever occupies columns strictly inside the target's own rectangle, which
 * `packChildLayout` already guarantees nothing else in `packed` overlaps.
 * That's also why `resolveExplicitCollisions` never needs to run again
 * after one — there is nothing left for it to find.
 */
export function resolveDropPlacement(
  packed: Record<string, PackedRect>,
  columns: number,
  exactCol: number,
  exactRow: number,
  maxRowSpan: number,
  maxColSpan: number,
): DropPlacement {
  const cursorCol = Math.floor(exactCol);
  const cursorRow = Math.floor(exactRow);
  const occupancy = buildOccupancy(packed);
  const hitId = occupancy.get(cellKey(cursorCol, cursorRow));

  if (hitId === undefined) {
    return {
      rect: availableDropSpan(
        packed,
        columns,
        cursorCol,
        cursorRow,
        maxRowSpan,
        maxColSpan,
      ),
    };
  }

  const target = packed[hitId];
  const fracY = (exactRow - target.y) / target.h;
  const insertAbove: DropPlacement = {
    rect: { x: 0, y: target.y, w: columns, h: maxRowSpan },
  };
  const insertBelow: DropPlacement = {
    rect: { x: 0, y: target.y + target.h, w: columns, h: maxRowSpan },
  };

  if (fracY < EDGE_BAND_FRACTION) return insertAbove;
  if (fracY > 1 - EDGE_BAND_FRACTION) return insertBelow;
  if (target.w < MIN_SPLIT_COLUMNS) {
    return fracY < 0.5 ? insertAbove : insertBelow;
  }

  const newW = Math.floor(target.w / 2);
  const keepW = target.w - newW;
  const takesLeftHalf = exactCol < target.x + target.w / 2;

  if (takesLeftHalf) {
    return {
      rect: { x: target.x, y: target.y, w: newW, h: target.h },
      shrink: {
        id: hitId,
        rect: { x: target.x + newW, y: target.y, w: keepW, h: target.h },
      },
    };
  }
  return {
    rect: { x: target.x + keepW, y: target.y, w: newW, h: target.h },
    shrink: {
      id: hitId,
      rect: { x: target.x, y: target.y, w: keepW, h: target.h },
    },
  };
}

function rectsOverlap(
  a: { col: number; row: number; colSpan: number; rowSpan: number },
  b: { col: number; row: number; colSpan: number; rowSpan: number },
): boolean {
  return (
    a.col < b.col + b.colSpan &&
    b.col < a.col + a.colSpan &&
    a.row < b.row + b.rowSpan &&
    b.row < a.row + a.rowSpan
  );
}

/**
 * Resolves collisions among a container's *explicitly* placed children
 * (both `col` and `row` set) by pushing a later-declared one straight down,
 * one row at a time, until it no longer overlaps an earlier one — the same
 * "displace, never shrink" rule interactive resize/drag already gets on the
 * root's own grid (see `RootGrid`), applied here for the programmatic
 * placement path (`DashboardProvider.addWidget`/`updateLayout`, which
 * an extension's AI tools call directly) so both give the same "nothing ends
 * up stuck overlapping" guarantee, not just the one driven by a mouse. The
 * one place anything *does* get shrunk instead of displaced is a left/right
 * split (`resolveDropPlacement`) — and even there, only on an explicit
 * author gesture, at drop time, never as a side effect of resolving someone
 * else's collision the way this function does.
 *
 * Auto-placed children (`col`/`row` omitted) are skipped entirely — they
 * have no fixed position to resolve; they flow around whatever's explicit
 * at render time instead (see `packChildLayout`).
 *
 * Returns only the children whose position actually needed to change, in
 * `{col, row}` form ready for `DashboardProvider.updateLayouts`.
 */
export function resolveExplicitCollisions(
  children: readonly string[],
  columns: number,
  getNode: (id: string) => DashboardNode | undefined,
): Record<string, { col: number; row: number }> {
  const placed: {
    col: number;
    row: number;
    colSpan: number;
    rowSpan: number;
  }[] = [];
  const adjustments: Record<string, { col: number; row: number }> = {};

  children.forEach(id => {
    const layout = getNode(id)?.layout;
    if (layout?.col == null || layout?.row == null) return;

    const rect = {
      col: layout.col,
      row: layout.row,
      colSpan: Math.min(layout.colSpan ?? columns, columns),
      rowSpan: layout.rowSpan ?? 1,
    };
    while (placed.some(other => rectsOverlap(other, rect))) {
      rect.row += 1;
    }
    if (rect.row !== layout.row) {
      adjustments[id] = { col: rect.col, row: rect.row };
    }
    placed.push(rect);
  });

  return adjustments;
}

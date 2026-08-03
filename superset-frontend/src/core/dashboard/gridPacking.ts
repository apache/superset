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

/** A child's resolved position/size, in `react-grid-layout`'s own 0-based coordinate convention. */
export interface PackedRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Resolves a definite `{x, y, w, h}` for every child of a container, given
 * only each child's own `layout` — which, per the dashboard schema, may omit
 * `col`/`row` entirely to request auto-placement. `react-grid-layout` has no
 * "auto" position of its own; every item in the layout array fed to it needs
 * concrete coordinates, so this is the one-time translation from "no
 * position specified" to "here's where that currently lands."
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
        occupied.add(`${x + dx},${y + dy}`);
      }
    }
  };

  const fits = (x: number, y: number, w: number, h: number) => {
    if (x + w > columns) return false;
    for (let dy = 0; dy < h; dy += 1) {
      for (let dx = 0; dx < w; dx += 1) {
        if (occupied.has(`${x + dx},${y + dy}`)) return false;
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
 * "displace, never shrink" rule interactive resize/drag already gets from
 * `react-grid-layout` (see `CanvasBlock`), applied here for the
 * programmatic placement path (`DashboardProvider.addBuildingBlock`/
 * `updateLayout`, which an extension's AI tools call directly) so both give
 * the same "nothing ends up stuck overlapping" guarantee, not just the one
 * driven by a mouse.
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

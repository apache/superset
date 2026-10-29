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

/**
 * @fileoverview The grid placement rules, for previewing a drop.
 *
 * A deliberate second implementation of `superset/canvas/definition/grid.py`:
 * the server stays the authority and its answer is what gets stored, but a
 * drag needs to show where the neighbours will end up *before* the write, so
 * the same rules have to run locally while the pointer moves.
 *
 * The two are kept honest by `grid_cases.json`, which both test suites read —
 * generated from the server, so a change there that this file doesn't follow
 * fails on both sides.
 *
 * Children resolve in reading order:
 *
 * - An explicitly placed child (`col`/`row` set) keeps its column, and is
 *   pushed straight down until it clears anything resolved before it.
 * - An auto-placed child (`col`/`row` omitted) takes the first free slot that
 *   fits its span, scanning from a cursor that only moves forward.
 *
 * Reading order decides who yields, so a drop also moves the dragged widget
 * within it: see `previewGrid`.
 */

import type { GridLayout, GridPlacement } from './types';

export type { GridLayout };

const cells = (rect: GridPlacement): string[] => {
  const out: string[] = [];
  for (let { row } = rect; row < rect.row + rect.rowSpan; row += 1) {
    for (let { col } = rect; col < rect.col + rect.colSpan; col += 1) {
      out.push(`${row}:${col}`);
    }
  }
  return out;
};

const clear = (rect: GridPlacement, occupied: Set<string>): boolean =>
  cells(rect).every(cell => !occupied.has(cell));

/**
 * Where each child lands on a grid of `columns` columns, in reading order.
 *
 * Mirrors the server's `resolve_grid`. Spans default to the full width and a
 * single row, and a span wider than the grid is clamped to it.
 */
export function resolveGrid(
  layouts: GridLayout[],
  columns: number,
): GridPlacement[] {
  const occupied = new Set<string>();
  const resolved: GridPlacement[] = [];
  let cursorRow = 1;
  let cursorCol = 1;

  layouts.forEach(layout => {
    const colSpan = Math.min(layout.colSpan || columns, columns);
    const rowSpan = layout.rowSpan || 1;
    let rect: GridPlacement;

    if (layout.col !== undefined && layout.col !== null) {
      rect = {
        col: layout.col,
        row: layout.row as number,
        colSpan,
        rowSpan,
      };
      while (!clear(rect, occupied)) {
        rect = { ...rect, row: rect.row + 1 };
      }
    } else {
      let row = cursorRow;
      let col = cursorCol;
      for (;;) {
        if (col + colSpan - 1 > columns) {
          row += 1;
          col = 1;
          // eslint-disable-next-line no-continue
          continue;
        }
        rect = { col, row, colSpan, rowSpan };
        if (clear(rect, occupied)) break;
        col += 1;
      }
      cursorRow = rect.row;
      cursorCol = rect.col + colSpan;
    }

    cells(rect).forEach(cell => occupied.add(cell));
    resolved.push(rect);
  });

  return resolved;
}

/**
 * Where a node dropped at `target` belongs in `rects`' reading order.
 *
 * `rects` is the siblings it lands among, resolved and in reading order,
 * without the dropped node. Mirrors the server's `insert_index`: an overlap
 * pushes the *later* child down, so the dropped node goes before the first
 * sibling it overlaps, or that starts after it by row and then column, and
 * last if there is no such sibling.
 *
 * Landing on a sibling is above it or below it depending on where: past the
 * sibling's middle is below it. Without that, aiming at the bottom of a tall
 * neighbour -- a ten-row group, say -- still counts as landing on it, so the
 * widget is inserted ahead and the whole group is pushed down underneath
 * something dropped at its feet.
 */
export function insertIndex(
  rects: GridPlacement[],
  target: GridPlacement,
): number {
  const targetCells = new Set(cells(target));
  const found = rects.findIndex(rect => {
    if (cells(rect).some(cell => targetCells.has(cell))) {
      return target.row < rect.row + rect.rowSpan / 2;
    }
    return (
      rect.row > target.row ||
      (rect.row === target.row && rect.col >= target.col)
    );
  });
  return found === -1 ? rects.length : found;
}

/**
 * The placements a grid would settle on if `moving` were dropped at `target`.
 *
 * The dragged widget takes `target` and is moved in reading order to sit ahead
 * of the first sibling it overlaps, or that starts after it (by row, then
 * column). Reading order is what decides who yields, so without the reorder a
 * widget dropped onto an earlier sibling would lose and be pushed back under
 * it -- making it impossible to drop anything between two others.
 *
 * This mirrors the reorder the server's `place` operation performs, so the
 * preview and the write agree.
 */
export function previewGrid(
  childIds: string[],
  /** Each child's *stored* layout, which is what the server resolves from. */
  layouts: Record<string, GridLayout>,
  placements: Record<string, GridPlacement>,
  moving: string,
  target: GridPlacement,
  columns: number,
): Record<string, GridPlacement> {
  const others = childIds.filter(nodeId => nodeId !== moving);
  // Stored layouts, not resolved rectangles: an auto-placed child has no
  // `col`/`row` of its own, and feeding back the rectangle it happens to
  // occupy would make it explicit here while the server still auto-places
  // it. The preview would then disagree with the drop.
  const otherLayouts = others.map(nodeId => layouts[nodeId]);
  // A child the caller knows nothing about cannot take part in the preview.
  if (otherLayouts.some(layout => layout === undefined)) return placements;

  // Where the others sit on their own, which is the order the dropped widget
  // is inserted into.
  const before = resolveGrid(otherLayouts as GridLayout[], columns);
  const ordered = [...others];
  ordered.splice(insertIndex(before, target), 0, moving);

  const resolved = resolveGrid(
    ordered.map(nodeId =>
      nodeId === moving ? target : (layouts[nodeId] as GridLayout),
    ),
    columns,
  );
  return Object.fromEntries(ordered.map((id, index) => [id, resolved[index]]));
}

/**
 * The single widget a drop lands on, if it lands squarely on one.
 *
 * Dropping onto one widget exchanges places with it: the dropped widget takes
 * its slot, and it takes the slot the dropped widget came from. Dragging
 * upwards already looked like that, but only by coincidence -- the rule is
 * "insert before what you overlap, push it down", and pushing a widget down
 * from the top happens to land it where the dragged one started. Pushed down
 * from lower in the grid it lands somewhere new, so the same gesture read as
 * a swap in one direction and a shove in the other.
 *
 * Nothing, when the drop straddles two widgets or lands on empty space: there
 * is no single partner to exchange with, so the push-down rule still applies.
 */
export function swapPartner(
  childIds: string[],
  placements: Record<string, GridPlacement>,
  moving: string,
  target: GridPlacement,
): string | undefined {
  const landing = new Set(cells(target));
  const touched = childIds.filter(
    nodeId =>
      nodeId !== moving &&
      placements[nodeId] &&
      cells(placements[nodeId]).some(cell => landing.has(cell)),
  );
  return touched.length === 1 ? touched[0] : undefined;
}

/** Where two widgets end up once they exchange places. */
export function swapped(
  partner: GridPlacement,
  vacated: GridPlacement,
  columns: number,
): GridPlacement {
  // Its own size, in the slot the dragged widget left: a swap exchanges
  // places, not shapes. The column is pulled back far enough for that size
  // to fit -- a widget wider than the one it changes places with would
  // otherwise start where the narrower one did and run off the grid, which
  // the server rejects, taking the whole swap with it.
  const col = Math.max(1, Math.min(vacated.col, columns - partner.colSpan + 1));
  return { ...partner, col, row: vacated.row };
}

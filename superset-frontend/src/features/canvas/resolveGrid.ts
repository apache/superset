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
 * The placements a grid would settle on if `moving` were dropped at `target`.
 *
 * Children keep their reading order, so the dragged widget pushes the ones
 * after it down exactly as the server will once the drop is written.
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
  // Stored layouts, not resolved rectangles: an auto-placed child has no
  // `col`/`row` of its own, and feeding back the rectangle it happens to
  // occupy would make it explicit here while the server still auto-places
  // it. The preview would then disagree with the drop.
  const toResolve = childIds.map(nodeId =>
    nodeId === moving ? target : layouts[nodeId],
  );
  // A child the caller knows nothing about cannot take part in the preview.
  if (toResolve.some(layout => layout === undefined)) return placements;

  const resolved = resolveGrid(toResolve as GridLayout[], columns);
  return Object.fromEntries(childIds.map((id, index) => [id, resolved[index]]));
}

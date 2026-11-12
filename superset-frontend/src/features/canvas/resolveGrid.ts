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
 * - An explicitly placed child (`col`/`row` set) that overlaps something
 *   resolved before it moves aside: along its own row while there is room to
 *   its right, and only down once the row is full, back at the column it
 *   asked for.
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
      const home = layout.col;
      rect = { col: home, row: layout.row as number, colSpan, rowSpan };
      while (!clear(rect, occupied)) {
        if (rect.col + colSpan - 1 < columns) {
          // Room beside it on this row: a widget dropped on the left half of
          // a row slides its neighbour into the free right half, rather than
          // sending it to a row of its own and leaving that half empty.
          rect = { ...rect, col: rect.col + 1 };
        } else {
          // The row is full to the right, so down it goes -- back at the
          // column it asked for, since the next row is clear of everything
          // placed so far.
          rect = { ...rect, col: home, row: rect.row + 1 };
        }
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

/** A node being given a layout: one `place` operation's worth of change. */
export interface PlaceOp {
  nodeId: string;
  layout: GridLayout;
}

/** The rectangle a layout asks for, before anything is resolved. */
const targetRect = (layout: GridLayout, columns: number): GridPlacement => ({
  col: layout.col as number,
  row: layout.row as number,
  colSpan: Math.min(layout.colSpan || columns, columns),
  rowSpan: layout.rowSpan || 1,
});

/**
 * Where a node placed at `layout` belongs among its siblings.
 *
 * Mirrors the server's `place_index`. The siblings are resolved first because
 * that is what the comparison is against: the dropped node goes among where
 * they actually sit, not where they asked to.
 */
const placeIndex = (
  siblingLayouts: GridLayout[],
  layout: GridLayout,
  columns: number,
): number =>
  insertIndex(
    resolveGrid(siblingLayouts, columns),
    targetRect(layout, columns),
  );

/**
 * Where a grid settles after `ops` are applied to it in order.
 *
 * Mirrors the server's `replay_places`. Each operation gives a node a layout
 * and moves it in reading order, and the next one runs against the grid that
 * leaves behind -- so applying two of them is not the same as deciding both
 * against the grid as it stands now. Replaying the very operations that are
 * about to be sent is what makes a preview the write's result rather than a
 * guess at it.
 */
export function replayPlacements(
  childIds: string[],
  layouts: Record<string, GridLayout>,
  columns: number,
  ops: PlaceOp[],
): { order: string[]; placements: Record<string, GridPlacement> } {
  let order = [...childIds];
  const settled: Record<string, GridLayout> = { ...layouts };

  ops.forEach(({ nodeId, layout }) => {
    settled[nodeId] = layout;
    // Auto-placed nodes keep their order: they have no `col` to drop at.
    if (layout.col === undefined) return;
    const others = order.filter(id => id !== nodeId);
    others.splice(
      placeIndex(
        others.map(id => settled[id] ?? {}),
        layout,
        columns,
      ),
      0,
      nodeId,
    );
    order = others;
  });

  const resolved = resolveGrid(
    order.map(id => settled[id] ?? {}),
    columns,
  );
  return {
    order,
    placements: Object.fromEntries(
      order.map((id, index) => [id, resolved[index]]),
    ),
  };
}

/**
 * The placements a grid would settle on if `moving` were dropped at `target`.
 *
 * One `place` replayed: see `replayPlacements`. The dragged widget takes
 * `target` and is moved in reading order to sit ahead of the first sibling it
 * overlaps, or that starts after it (by row, then column). Reading order is
 * what decides who yields, so without the reorder a widget dropped onto an
 * earlier sibling would lose and be pushed back under it -- making it
 * impossible to drop anything between two others.
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
  //
  // A child the caller knows nothing about cannot take part in the preview.
  const unknown = childIds.some(
    nodeId => nodeId !== moving && layouts[nodeId] === undefined,
  );
  if (unknown) return placements;

  return replayPlacements(childIds, layouts, columns, [
    { nodeId: moving, layout: target },
  ]).placements;
}

/**
 * Where a grid settles once two of its widgets exchange places.
 *
 * Mirrors the server's `swap` operation: resolve first, so a widget that was
 * auto-placed exchanges where it actually sits rather than the nothing its
 * layout says; give each the other's slot at its own size; then reorder only
 * the one that was dragged, since the one it displaced is going where that
 * widget just was, which is free.
 */
export function swapPlacements(
  childIds: string[],
  layouts: Record<string, GridLayout>,
  columns: number,
  nodeId: string,
  partnerId: string,
): { order: string[]; placements: Record<string, GridPlacement> } {
  const resolved = resolveGrid(
    childIds.map(id => layouts[id] ?? {}),
    columns,
  );
  const at = Object.fromEntries(childIds.map((id, i) => [id, resolved[i]]));

  const taking = (id: string, slot: GridPlacement): GridLayout => ({
    ...layouts[id],
    // Far enough left for its own width to fit: a wider widget changing
    // places with a narrower one would otherwise start where the narrow one
    // did and run off the grid, which the server rejects outright.
    col: Math.max(1, Math.min(slot.col, columns - at[id].colSpan + 1)),
    row: slot.row,
  });

  const next = {
    ...layouts,
    [nodeId]: taking(nodeId, at[partnerId]),
    [partnerId]: taking(partnerId, at[nodeId]),
  };
  return replayPlacements(childIds, next, columns, [
    { nodeId, layout: next[nodeId] },
  ]);
}

/** A canvas's grids: who holds whom, how wide, and what each keeps for itself. */
export interface GridTree {
  /** Each grid's children in reading order, the root grid included. */
  childOrder: Record<string, string[]>;
  /** The column count of each grid container; the root's is passed separately. */
  columns: Record<string, number>;
  /** Rows a container keeps above its grid for its own chrome, e.g. a title. */
  chromeRows: Record<string, number>;
}

/** How deep each grid sits, so the innermost can be settled first. */
const depths = (childOrder: Record<string, string[]>, rootId: string) => {
  const parent: Record<string, string> = {};
  Object.entries(childOrder).forEach(([container, children]) => {
    children.forEach(child => {
      parent[child] = container;
    });
  });
  return Object.keys(childOrder).reduce<Record<string, number>>((out, id) => {
    let depth = 0;
    let at = id;
    while (at !== rootId && parent[at] !== undefined) {
      at = parent[at];
      depth += 1;
    }
    return { ...out, [id]: depth };
  }, {});
};

/**
 * The layouts with every container grown to hold what is in it.
 *
 * Mirrors the server's `_resolve_layouts` and `_fit`: a container takes its
 * children's extent plus the rows it keeps for its own chrome, and is only
 * ever grown, never shrunk. Deepest first, so a container holding a container
 * sees the inner one's height already settled.
 *
 * `undefined` when nothing needed growing, which is the ordinary case. The
 * caller then keeps the placements the server sent rather than re-deriving
 * them: the two agree, and re-deriving an answer that is already correct only
 * creates somewhere for them to disagree.
 *
 * Without this a widget dropped past a group's last row is drawn outside the
 * group's box -- and the group clips, so it is drawn cut in half -- for as
 * long as the write takes to come back and say what this already knows.
 */
export function fitContainers(
  tree: GridTree,
  layouts: Record<string, GridLayout>,
  rootId: string,
): Record<string, GridLayout> | undefined {
  const depth = depths(tree.childOrder, rootId);
  const inner = Object.keys(tree.childOrder)
    .filter(id => id !== rootId)
    .sort((a, b) => depth[b] - depth[a]);

  let grown: Record<string, GridLayout> | undefined;
  const at = (id: string) => (grown ?? layouts)[id] ?? {};

  inner.forEach(container => {
    const columns = tree.columns[container];
    // Only a grid of its own has an extent to measure. A container that lays
    // its children out some other way -- tabs, a board -- is the server's to
    // size, and guessing here would fight it.
    if (columns === undefined) return;
    const children = tree.childOrder[container] ?? [];
    const rects = resolveGrid(
      children.map(id => at(id)),
      columns,
    );
    const extent = rects.reduce(
      (tallest, rect) => Math.max(tallest, rect.row + rect.rowSpan - 1),
      0,
    );
    // An empty container keeps the height it was given: there is nothing in
    // it to measure, and the chrome alone is not a reason to resize it.
    if (extent === 0) return;
    const needed = extent + (tree.chromeRows[container] ?? 0);
    const layout = at(container);
    if ((layout.rowSpan || 1) >= needed) return;
    grown = {
      ...(grown ?? layouts),
      [container]: { ...layout, rowSpan: needed },
    };
  });

  return grown;
}

/**
 * Where every node sits once the containers have been grown to fit.
 *
 * `undefined` when nothing needed growing; see `fitContainers`.
 */
export function fitPlacements(
  tree: GridTree,
  layouts: Record<string, GridLayout>,
  rootId: string,
  rootColumns: number,
): Record<string, GridPlacement> | undefined {
  const grown = fitContainers(tree, layouts, rootId);
  if (!grown) return undefined;

  const placements: Record<string, GridPlacement> = {};
  Object.entries(tree.childOrder).forEach(([container, children]) => {
    const columns =
      container === rootId ? rootColumns : tree.columns[container];
    if (columns === undefined) return;
    resolveGrid(
      children.map(id => grown[id] ?? {}),
      columns,
    ).forEach((rect, index) => {
      placements[children[index]] = rect;
    });
  });
  return placements;
}

/**
 * The placements a grid settles on with some of its containers held open.
 *
 * `atLeast` is the rows each named container needs, which only the grid
 * inside it knows: a gesture running in there has pushed its contents past
 * the height its container is *stored* as, and the stored height is all
 * `fitContainers` can see until the write lands.
 *
 * `undefined` when every container already has the room it is asking for,
 * which is almost always -- the caller then keeps the placements it had
 * rather than a second derivation of them.
 */
export function withRoom(
  childIds: string[],
  layouts: Record<string, GridLayout>,
  columns: number,
  atLeast: Record<string, number>,
): Record<string, GridPlacement> | undefined {
  let held: Record<string, GridLayout> | undefined;
  childIds.forEach(id => {
    const rows = atLeast[id];
    const layout = layouts[id];
    if (rows === undefined || !layout || (layout.rowSpan || 1) >= rows) return;
    held = { ...(held ?? layouts), [id]: { ...layout, rowSpan: rows } };
  });
  if (!held) return undefined;

  const grown = held;
  const resolved = resolveGrid(
    childIds.map(id => grown[id] ?? {}),
    columns,
  );
  return Object.fromEntries(childIds.map((id, index) => [id, resolved[index]]));
}

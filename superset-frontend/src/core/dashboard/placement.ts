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
 * @fileoverview Placing a new block, in the one place both ways of asking
 * for it can reach.
 *
 * A block arrives on a dashboard two ways — clicked in the palette, or
 * dragged from it onto a container — and they must produce the same node. Two
 * copies of "what a freshly placed block looks like" is how a block dropped
 * into a section ends up subtly different from the same block clicked into
 * it, and the difference is invisible until someone hits it.
 */

import { GRID_TYPE, isContainerType } from './DashboardProvider';
import { DEFAULT_COLUMNS } from './layoutStyle';
import { provider } from './store';

/**
 * What a palette drag carries.
 *
 * A private type rather than `text/plain` so a drop of anything else — a
 * file, a selection of text, a drag from another application — is not read
 * as a request to place a block.
 */
export const PALETTE_MIME = 'application/x-dashboard-building-block';

/**
 * A type's own starting `rowSpan` on the root grid, in row tracks (a row is
 * `rowUnitPx` tall, 32px by default — see `layoutStyle.ts`). Left unset
 * (`gridPacking.ts`'s own fallback of 1 row) a freshly placed block sits
 * shorter than `BuildingBlockView`'s header-plus-padding chrome alone, before
 * any content of its own — every leaf type would open already clipped or
 * scrolling. Tuned per type instead of one shared number because what fills
 * that box varies enough that one height leaves half of them cramped and the
 * other half wasting space: a metric tile is a few lines centered in a card,
 * a table wants room for a header row and several data rows, a fresh `tabs`
 * pays for a tab bar and a flow area's own padding before its empty state
 * even starts. An author who wants a block smaller still has the resize
 * handle for that — this is only the size nobody has touched it at yet.
 *
 * Root-grid-only: a `rowSpan` off this table is meaningless (and, worse,
 * silently wrong) for a block placed into anything else — a `tabs` pane, a
 * `collapsible`, a `carousel` slide — since those read `rowSpan` in their
 * own unit, a flow area's own pixel (see `FlowContent`'s own comment), not
 * a grid row track. `placeBlock`/`placeBlockAt` only reach into this table
 * once they've confirmed the parent actually is the root's own grid.
 */
const DEFAULT_ROW_SPAN: Record<string, number> = {
  markdown: 5,
  echarts: 8,
  'ag-grid-table': 9,
  'metric-tile': 4,
  tabs: 6,
  collapsible: 5,
  carousel: 5,
};

/**
 * Row span for a type this module has no specific tuning for — an
 * extension-contributed block, most likely — and also `RootGrid`'s own
 * starting height for a block whose *position* came from a palette drag
 * rather than this module's per-type table (see `placeBlockAt`): a drag
 * already answers where a block lands, live, as the gesture happens, and
 * asking it to also settle on a bespoke height per type at the same time is
 * more than one gesture should have to carry. Generous rather than tight:
 * better an unfamiliar block opens a little taller than it needed to than
 * clipped or scrolling before anyone has seen what it renders.
 */
export const FALLBACK_ROW_SPAN = 6;

/**
 * Places a new block of `type` at the end of `parentId`'s children and
 * selects it, returning its id.
 *
 * A container arrives with the grid every other container defaults to, so a
 * nested canvas is usable the moment it lands rather than needing its columns
 * set before anything can go inside it. Selecting what was just placed is
 * what brings its properties forward: placing something is the moment you
 * want to configure it.
 *
 * `rowSpan` is only ever set here when `parentId` is the root's own grid —
 * everywhere else (a `tabs` pane, a `collapsible`, a `carousel` slide) it's
 * left unset entirely, on purpose, so `FlowItem` (see `flowContent.tsx`)
 * reads that as "no height chosen yet" and flexes the block to fill
 * whatever room the container actually has, rather than a grid-row number
 * misread as a pixel count.
 */
export function placeBlock(parentId: string, type: string): string {
  const index = provider.getNode(parentId)?.children?.length ?? 0;
  const onRootGrid = provider.getNode(parentId)?.type === GRID_TYPE;
  const rowSpan = onRootGrid
    ? (DEFAULT_ROW_SPAN[type] ?? FALLBACK_ROW_SPAN)
    : undefined;
  const id = provider.addBuildingBlock(parentId, index, {
    type,
    layout: isContainerType(type)
      ? { columns: DEFAULT_COLUMNS, gap: 16, colSpan: DEFAULT_COLUMNS, rowSpan }
      : { rowSpan },
  });
  provider.setSelection(id);
  return id;
}

/**
 * Places a new block of `type` at an explicit grid cell and an explicit
 * spot in `parentId`'s own reading order, rather than appending it
 * full-width at the end the way `placeBlock` does — `RootGrid`'s own
 * counterpart for a palette block dropped onto the root's grid, where
 * *where* (and how wide, next to whatever it landed beside) was the entire
 * point of the gesture.
 *
 * `position` arrives already resolved: react-grid-layout ran its own
 * collision avoidance live, during the drag itself, the same as it does for
 * repositioning an existing block (see `RootGrid`'s own `isDroppable`
 * wiring) — nothing here recomputes a position, only writes the one already
 * shown as the drop's own preview.
 *
 * `index`, unlike `placeBlock`'s own implicit "at the end," is the caller's
 * to get right: `DashboardProvider`'s own collision resolution (see
 * `resolveExplicitCollisions`) settles a tie between two explicitly placed
 * siblings by pushing down whichever comes *later* in `children` — so a
 * block dropped, say, between two existing rows has to land earlier in that
 * order than the row it is displacing, or collision resolution reads it
 * backwards and pushes the new block itself down past everything instead of
 * making room for it where it was actually dropped. `RootGrid` is what
 * already knows every sibling's own current position (it just packed them,
 * to draw this render's preview in the first place), so it is the one that
 * resolves reading order too, rather than this module re-deriving it from
 * scratch here.
 */
export function placeBlockAt(
  parentId: string,
  type: string,
  index: number,
  position: { col: number; row: number; colSpan: number; rowSpan: number },
): string {
  const id = provider.addBuildingBlock(parentId, index, {
    type,
    layout: isContainerType(type)
      ? { columns: DEFAULT_COLUMNS, gap: 16, ...position }
      : { ...position },
  });
  provider.setSelection(id);
  return id;
}

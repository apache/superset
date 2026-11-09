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
 * @fileoverview What a drag could mean, as states to choose between.
 *
 * A gesture has more than one reading. Dropping a widget on empty space puts
 * it there; dropping it exactly where another widget lives trades places with
 * that one; a gesture that ends where it began does nothing. Deciding between
 * them by branching -- "is one widget overlapped? then swap" -- meant the
 * preview and the write each made the decision for themselves, from different
 * code, and replaying real drops showed them disagreeing about a third of the
 * time.
 *
 * So the decision is made in one place. `chooseDrop` lists the readings a
 * drop could have, settles the grid for each by the rules the server applies,
 * and picks the one that leaves the dragged widget closest to where the
 * pointer is holding it. The preview calls it and the release calls it, with
 * the same inputs, so what lands is what was shown.
 *
 * After "Declarative Dragging" (Horowitz, Blinn and Heer, UIST 2026), which
 * names the shape: enumerate the model states a gesture can reach, render
 * each, read the dragged element's position out of each, choose by distance.
 * A state of ours is four integers per widget rather than a rendered scene,
 * so settling one costs a grid resolve instead of a React commit -- which is
 * why we can afford to settle every candidate on every pointer move, and why
 * none of this needs a DOM to test.
 */

import { type GridDelta, movedPlacement, samePlacement } from './gridGeometry';
import { previewGrid, swapPlacements } from './resolveGrid';
import type { GestureKind, GridLayout, GridPlacement } from './types';

/** The grid a drop happens on, as the rules need to see it. */
export interface GridState {
  childIds: string[];
  /** Each child's *stored* layout, which is what the server resolves from. */
  layouts: Record<string, GridLayout>;
  /** Where each child sits as things stand. */
  placements: Record<string, GridPlacement>;
  columns: number;
}

export type DropKind = 'place' | 'swap';

/** One reading of where a gesture is trying to put a widget. */
export interface Drop {
  /**
   * The reading's identity: its kind, its partner and the cell it asks for.
   * The cell is part of it because that is what two readings either side of a
   * boundary differ by, and holding on to one of them across a pointer move
   * is exactly what stickiness does -- see `select`.
   */
  id: string;
  kind: DropKind;
  /** The rectangle this reading asks the dragged widget to take. */
  target: GridPlacement;
  /** The widget it trades places with, for a `swap`. */
  partner?: string;
}

/** A reading with the grid settled around it. */
export interface Settled {
  drop: Drop;
  /** Where every child of the grid sits if this drop happens. */
  placements: Record<string, GridPlacement>;
  /** Where the dragged widget itself ends up, which is what is scored. */
  rect: GridPlacement;
}

/**
 * Where the dragged widget is actually being held, in grid units but
 * unrounded, plus how large a unit is in pixels.
 *
 * The fraction is the whole point: it is what lets two readings a cell apart
 * be told apart *after* the grid has settled around each, rather than by
 * rounding the pointer first and settling only the winner. The pitches are
 * carried so a column and a row compare in pixels -- a canvas column is a
 * third the height of a row, and scoring in bare grid units would make
 * vertical aim count for three times as much as horizontal.
 */
export interface Aim {
  col: number;
  row: number;
  colPitch: number;
  rowPitch: number;
}

/**
 * Which reading wins, before distance is even looked at.
 *
 * A trade, when one is on offer, beats every plain drop. Distance cannot
 * decide this: a plain drop puts the widget exactly where the pointer asked,
 * so by that measure it always wins, and a trade would never happen at all.
 *
 * What the two differ in is everything *else* on the grid. Landing squarely
 * on a widget in a row with no slack in it, a plain drop shoves that widget
 * aside, which shoves the next one, until the last runs out of room and wraps
 * onto a row of its own -- three tiles across become two and an orphan, from a
 * gesture that asked to move one of them. The trade moves exactly the two
 * widgets it is about. Scoring only where the dragged widget lands is blind to
 * that, which is how it was got wrong.
 */
const RANK: Record<DropKind, number> = { swap: 0, place: 1 };

/** Rounding noise, well below the pixel a difference would show up as. */
const EPSILON = 1e-6;

/**
 * How far a settled reading leaves the widget from where it is held.
 *
 * Measured at the widget's own top-left corner rather than at the pointer:
 * the grab offset inside the widget is already what the gesture preserves
 * (`placementAt`), so corner-to-corner is the distance the user is actually
 * steering, and it needs no knowledge of where in the widget they took hold.
 */
export const aimDistance = (rect: GridPlacement, aim: Aim): number =>
  Math.hypot(
    (rect.col - aim.col) * aim.colPitch,
    (rect.row - aim.row) * aim.rowPitch,
  );

/** Whether two rectangles share any cell. */
const overlaps = (a: GridPlacement, b: GridPlacement): boolean =>
  a.col < b.col + b.colSpan &&
  b.col < a.col + a.colSpan &&
  a.row < b.row + b.rowSpan &&
  b.row < a.row + a.rowSpan;

/** A reading's identity: what it is, who with, and where. */
const identify = (
  kind: DropKind,
  target: GridPlacement,
  partner?: string,
): string =>
  [
    kind,
    partner ?? '',
    target.col,
    target.row,
    target.colSpan,
    target.rowSpan,
  ].join(':');

/** The cells a drop could snap to: the nearest one, and the four beside it. */
const NEARBY: GridDelta[] = [
  { cols: 0, rows: 0 },
  { cols: -1, rows: 0 },
  { cols: 1, rows: 0 },
  { cols: 0, rows: -1 },
  { cols: 0, rows: 1 },
];

/**
 * Every reading a drop of `nodeId` at `snap` could have.
 *
 * Staying put is deliberately not among them. It looks like the tidy way to
 * express a gesture that means nothing, but as a reading competing on
 * distance it wins whenever the grid pushes a contested drop far enough --
 * and then a drag of several rows ends with the widget back where it started
 * and nothing written, which is the one outcome a user cannot tell from a bug
 * (a thousandth of random drags, measured). Whether a drop is worth writing
 * is a separate question, asked afterwards by `changesAnything`.
 *
 * A move also offers a trade with the widget it lands on, and the four cells
 * next to the one it snapped to.
 *
 * The neighbouring cells never win on distance -- `snap` is by definition the
 * cell nearest the hand, and measuring forty thousand random drags they were
 * chosen exactly none of the time. They are here so that the cell the pointer
 * has just left is still among the readings on offer, which is the thing
 * stickiness holds on to when a hand rests on a boundary; see `select`.
 *
 * A resize is offered no neighbours, and not as an oversight: the widget
 * itself takes the previewed span under the hand rather than an outline doing
 * it (see `CanvasGridSurface`), so choosing a span other than the one the
 * pointer asked for would make the widget disagree with the pointer while
 * the user watched.
 *
 * Deliberately short, at most seven. The paper's own study found enumerating
 * states the hardest part of this style, and an unbounded set is a
 * performance problem besides; everything here is a reading a user could
 * name.
 */
export function enumerate(
  grid: GridState,
  nodeId: string,
  kind: GestureKind,
  snap: GridPlacement,
): Drop[] {
  const drops: Drop[] = [];

  // Clamped the way the gesture itself clamps, so a neighbour can only ever
  // be a cell the drag could have reached: at column 1 the one to the left is
  // column 1 again, and dedupes away.
  const cells = kind === 'move' ? NEARBY : [NEARBY[0]];
  cells.forEach(delta => {
    const target = movedPlacement(snap, delta, grid.columns);
    const id = identify('place', target);
    if (!drops.some(drop => drop.id === id)) {
      drops.push({ id, kind: 'place', target });
    }
  });

  // Growing a widget over its neighbour is not an offer to trade places with
  // it: the neighbour should be pushed out of the way, not teleported into a
  // slot this one still occupies.
  if (kind !== 'move') return drops;

  // The one widget the drop lands on. Overlap, not an exact landing: a tile
  // nudged two columns into its neighbour is aiming at that neighbour's
  // place, and asking the pointer to find the other widget's own corner is
  // asking for an accuracy the gesture does not have.
  //
  // Exactly one, though. Across two there is no single partner to trade with,
  // so reading order decides and the ones it lands among give way.
  const touched = grid.childIds.filter(
    id =>
      id !== nodeId &&
      grid.placements[id] &&
      overlaps(grid.placements[id], snap),
  );
  const partner = touched.length === 1 ? touched[0] : undefined;
  if (partner) {
    // The slot it is trading for, which is where this widget will sit --
    // `swapPlacements` applies the same column clamp when it settles it.
    const slot = grid.placements[partner];
    drops.push({
      id: identify('swap', slot, partner),
      kind: 'swap',
      target: { ...slot, colSpan: snap.colSpan, rowSpan: snap.rowSpan },
      partner,
    });
  }
  return drops;
}

/**
 * Where the grid settles if `drop` happens.
 *
 * The rules are the server's, mirrored (`resolveGrid.ts`), so this is the
 * state the write produces rather than a guess at it.
 */
export function resolve(grid: GridState, nodeId: string, drop: Drop): Settled {
  const { childIds, layouts, placements, columns } = grid;
  const settled =
    drop.kind === 'swap' && drop.partner
      ? swapPlacements(childIds, layouts, columns, nodeId, drop.partner)
          .placements
      : previewGrid(
          childIds,
          layouts,
          placements,
          nodeId,
          drop.target,
          columns,
        );
  return { drop, placements: settled, rect: settled[nodeId] ?? drop.target };
}

/** Every reading a drop could have, each with the grid settled around it. */
export function candidates(
  grid: GridState,
  nodeId: string,
  kind: GestureKind,
  snap: GridPlacement,
): Settled[] {
  return enumerate(grid, nodeId, kind, snap).map(drop =>
    resolve(grid, nodeId, drop),
  );
}

/**
 * The reading that leaves the dragged widget nearest where it is held.
 *
 * Arithmetic over readings already settled, so this can run on every pointer
 * move while the settling -- which only changes when the pointer crosses into
 * another cell -- does not have to.
 *
 * `held` is the reading chosen a moment ago, if any. Two readings a cell
 * apart swap places as nearest exactly halfway between them, so a hand
 * resting there would flip the whole grid back and forth on a pixel of
 * tremor; `held` keeps its place while it stays within a quarter of a cell of
 * the best. A quarter because the gap between two readings' distances closes
 * at twice the speed the pointer moves, so a quarter-cell margin holds on for
 * an eighth of a cell past the boundary -- nowhere near the next one, which
 * is what keeps stickiness able to delay a decision but never to outvote one.
 */
export function select(
  settled: Settled[],
  aim: Aim,
  held?: string,
): Settled | undefined {
  let best: { settled: Settled; distance: number } | undefined;
  let holding: { settled: Settled; distance: number } | undefined;

  settled.forEach(candidate => {
    const distance = aimDistance(candidate.rect, aim);
    if (candidate.drop.id === held) holding = { settled: candidate, distance };
    if (!best) {
      best = { settled: candidate, distance };
      return;
    }
    const rank = RANK[candidate.drop.kind] - RANK[best.settled.drop.kind];
    // Rank first and distance only within a rank: see `RANK`.
    if (rank < 0 || (rank === 0 && distance < best.distance - EPSILON)) {
      best = { settled: candidate, distance };
    }
  });

  if (!best) return undefined;
  // Only against a reading that would put the widget somewhere else.
  // Stickiness is there to stop a *position* flickering; two readings of the
  // same cell -- a trade and a plain drop on a widget's own slot -- are
  // separated by `RANK`, which no pointer movement can make flicker, and
  // holding the plain one would mean a trade could never be reached again
  // once the pointer had passed through that cell.
  const margin = 0.25 * Math.min(aim.colPitch, aim.rowPitch);
  if (
    holding &&
    RANK[holding.settled.drop.kind] <= RANK[best.settled.drop.kind] &&
    !samePlacement(holding.settled.rect, best.settled.rect) &&
    holding.distance <= best.distance + margin
  ) {
    return holding.settled;
  }
  return best.settled;
}

/**
 * What a drop of `nodeId` at `snap` means, and where it leaves the grid.
 *
 * The one entry point: both the preview and the release go through here, and
 * the preview is therefore the write's own answer rather than a second
 * opinion about it.
 */
export function chooseDrop(
  grid: GridState,
  nodeId: string,
  kind: GestureKind,
  snap: GridPlacement,
  aim: Aim,
  held?: string,
): Settled | undefined {
  return select(candidates(grid, nodeId, kind, snap), aim, held);
}

/** Whether a settled reading would change anything, and so is worth writing. */
export const changesAnything = (
  settled: Settled,
  origin: GridPlacement,
  current: GridPlacement,
): boolean =>
  !samePlacement(settled.drop.target, origin) &&
  !samePlacement(settled.drop.target, current);

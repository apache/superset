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

import {
  type Aim,
  candidates,
  changesAnything,
  chooseDrop,
  type Drop,
  enumerate,
  type GridState,
  resolve,
  select,
  type Settled,
} from './dragStates';
import type { GridPlacement } from './types';

/**
 * A grid whose children are all explicitly placed, so the layouts and the
 * placements are the same thing: these cases are about which drop is chosen,
 * not about resolution, which `resolveGrid.test.ts` pins against the server.
 */
const grid = (placements: Record<string, GridPlacement>): GridState => ({
  childIds: Object.keys(placements),
  layouts: placements,
  placements,
  columns: 24,
});

// A 24-column canvas 1000px wide with 16px gaps: a column is 42px across and
// a row is 56px tall. Deliberately unequal, which is what the pixel weighting
// in `aimDistance` exists for.
const COL_PITCH = 632 / 24 + 16;
const ROW_PITCH = 56;

const aimAt = (col: number, row: number): Aim => ({
  col,
  row,
  colPitch: COL_PITCH,
  rowPitch: ROW_PITCH,
});

const cell = (col: number, row: number): GridPlacement => ({
  col,
  row,
  colSpan: 4,
  rowSpan: 1,
});

/** Two full-width widgets stacked, the second directly under the first. */
const stacked = grid({
  a: { col: 1, row: 1, colSpan: 24, rowSpan: 4 },
  b: { col: 1, row: 5, colSpan: 24, rowSpan: 4 },
});

const kindsOf = (drops: Drop[]) => drops.map(drop => drop.kind);
const targetsOf = (drops: Drop[]) =>
  drops.map(drop => `${drop.target.col},${drop.target.row}`);

test('a drop is read as the cell it snapped to and the four beside it', () => {
  // Clear of everything, so this is only about the cells on offer. None of
  // the four can win on distance -- the snapped one is nearest by
  // construction -- but they keep the cell the pointer has just left on the
  // table for stickiness to hold.
  const drops = enumerate(stacked, 'a', 'move', {
    col: 7,
    row: 20,
    colSpan: 6,
    rowSpan: 2,
  });

  expect(kindsOf(drops)).toEqual(['place', 'place', 'place', 'place', 'place']);
  expect(targetsOf(drops)).toEqual(['7,20', '6,20', '8,20', '7,19', '7,21']);
});

test('a neighbour the gesture could not have reached is not offered twice', () => {
  // A full-width widget cannot move sideways at all, so both neighbours
  // across clamp back onto the snapped cell and fall away.
  const drops = enumerate(stacked, 'a', 'move', {
    col: 1,
    row: 20,
    colSpan: 24,
    rowSpan: 4,
  });

  expect(targetsOf(drops)).toEqual(['1,20', '1,19', '1,21']);
});

test('a drag is never read as leaving the widget where it was', () => {
  // Staying put used to be offered as a reading, and it won whenever the grid
  // pushed a contested drop far enough -- so a drag of several rows ended
  // with the widget back home and nothing written at all. Whether a drop is
  // worth writing is a separate question, asked by `changesAnything`.
  const drops = enumerate(stacked, 'a', 'move', stacked.placements.a);

  expect(kindsOf(drops)).not.toContain('stay');
});

test("a drop on another widget's own slot can also be read as a trade", () => {
  const drops = enumerate(stacked, 'a', 'move', stacked.placements.b);
  const trades = drops.filter(drop => drop.kind === 'swap');

  expect(trades).toHaveLength(1);
  expect(trades[0].partner).toBe('b');
  expect(trades[0].target).toEqual(stacked.placements.b);
});

test('a drop that lands on a widget at all can be read as a trade', () => {
  // One row into 'b' rather than squarely onto it. Asking the pointer to find
  // the other widget's own corner before a trade is on the table is asking
  // for an accuracy the gesture does not have -- and it left a tile nudged
  // into a packed row being read as a plain drop, which shoved every tile
  // after it until the last one wrapped onto a row of its own.
  const drops = enumerate(stacked, 'a', 'move', {
    col: 1,
    row: 4,
    colSpan: 24,
    rowSpan: 4,
  });
  const trades = drops.filter(drop => drop.kind === 'swap');

  expect(trades).toHaveLength(1);
  expect(trades[0].partner).toBe('b');
});

test('growing a widget over its neighbour is not a trade', () => {
  // The same rectangle that reads as a trade for a move. A resize has no
  // business offering one: the neighbour would jump into a slot the widget
  // being grown still occupies.
  const drops = enumerate(stacked, 'a', 'resize', stacked.placements.b);

  expect(kindsOf(drops)).toEqual(['place']);
});

test('nor is a resize offered a span beside the one it asked for', () => {
  // The widget itself takes the previewed span under the hand, so a span
  // other than the one the pointer asked for would have the widget disagree
  // with the pointer while the user watched it.
  const drops = enumerate(stacked, 'a', 'resize', {
    col: 1,
    row: 1,
    colSpan: 12,
    rowSpan: 4,
  });

  expect(drops).toHaveLength(1);
});

test('two readings that leave the widget in one place are settled by the trade', () => {
  // A trade and a plain drop both put the dragged widget on the partner's
  // slot; they differ only in what becomes of the partner. No pointer
  // position tells those apart, so the more specific reading is taken.
  const chosen = chooseDrop(
    stacked,
    'a',
    'move',
    stacked.placements.b,
    aimAt(1, 5),
  );

  expect(chosen?.drop.kind).toBe('swap');
  // 'b' takes the slot 'a' came from, rather than being pushed anywhere.
  expect(chosen?.placements.b).toEqual({
    col: 1,
    row: 1,
    colSpan: 24,
    rowSpan: 4,
  });
});

test('the snapped cell wins on an empty row, neighbours or no neighbours', () => {
  // `snap` is by definition the cell nearest the hand, so where nothing is in
  // the way no neighbour can be nearer -- which is why offering them changes
  // nothing about an ordinary drag.
  const chosen = chooseDrop(
    stacked,
    'a',
    'move',
    { col: 1, row: 20, colSpan: 24, rowSpan: 4 },
    aimAt(1, 20.2),
  );

  expect(chosen?.drop.target.row).toBe(20);
});

test('a trade beats a plain drop however well the plain drop is aimed', () => {
  // Three tiles across a group with no slack in it -- the row in the
  // recording this came from. Nudging the middle one two columns left is a
  // plain drop by distance, and it shoves the first tile six columns right,
  // which shoves the last one off the end and onto a row of its own. The
  // trade moves exactly the two tiles it is about.
  const row = grid({
    first: { col: 1, row: 1, colSpan: 4, rowSpan: 3 },
    middle: { col: 5, row: 1, colSpan: 4, rowSpan: 3 },
    last: { col: 9, row: 1, colSpan: 4, rowSpan: 3 },
  });
  const packed: GridState = { ...row, columns: 12 };
  const snap = { col: 3, row: 1, colSpan: 4, rowSpan: 3 };

  const chosen = chooseDrop(packed, 'middle', 'move', snap, aimAt(3, 1));

  expect(chosen?.drop.kind).toBe('swap');
  expect(chosen?.placements.middle.col).toBe(1);
  expect(chosen?.placements.first.col).toBe(5);
  // And the tile that had nothing to do with it is left where it was.
  expect(chosen?.placements.last).toEqual({
    col: 9,
    row: 1,
    colSpan: 4,
    rowSpan: 3,
  });
});

/** One widget alone, so a drop resolves to exactly the cell it asked for. */
const alone = grid({ a: cell(1, 1) });

const settledAt = (id: string, target: GridPlacement): Settled =>
  resolve(alone, 'a', { id, kind: 'place', target });

const near = settledAt('near', cell(5, 1));
const far = settledAt('far', cell(6, 1));

test('a reading is measured where the grid actually leaves the widget', () => {
  expect(select([near, far], aimAt(5.2, 1))?.drop.id).toBe('near');
  expect(select([near, far], aimAt(5.9, 1))?.drop.id).toBe('far');
});

test('a column and a row are compared in pixels, not in cells', () => {
  // One column out against one row out. In bare grid units they tie; in
  // pixels the row is half as far again, because a canvas row is taller than
  // a column is wide. Scoring in cells would make vertical aim count for more
  // than horizontal for no reason anyone chose.
  const sideways = settledAt('sideways', cell(2, 1));
  const downwards = settledAt('downwards', cell(1, 2));

  expect(select([sideways, downwards], aimAt(1, 1))?.drop.id).toBe('sideways');
});

test('the reading in hand keeps it while a nearer one is only just nearer', () => {
  // The pointer has crossed the boundary, but by less than a quarter of a
  // cell -- so the cell on the far side is now the nearer reading, and
  // nothing in hand would take it. Flipping back and forth over a boundary on
  // every pixel of hand tremor is what stickiness exists to stop.
  const aim = aimAt(5.4, 1);

  expect(select([near, far], aim)?.drop.id).toBe('near');
  expect(select([near, far], aim, 'far')?.drop.id).toBe('far');
});

test('and loses it once the pointer has clearly moved on', () => {
  // Past a quarter of a cell, which is half the distance between the two
  // readings: hysteresis that size cannot survive to the next boundary.
  expect(select([near, far], aimAt(5.1, 1), 'far')?.drop.id).toBe('near');
});

test('a reading that holds nothing in hand is unaffected by stickiness', () => {
  expect(select([near, far], aimAt(5.2, 1), 'gone')?.drop.id).toBe('near');
});

test('stickiness never holds a plain drop against a trade of the same cell', () => {
  // Two readings of one cell cannot flicker -- `RANK` separates them, and no
  // pointer movement changes that. Being sticky about them would mean a trade
  // became unreachable for the rest of a gesture once the pointer had passed
  // through that cell with a plain drop in hand.
  const settled = candidates(stacked, 'a', 'move', stacked.placements.b);
  const plain = settled.find(
    one =>
      one.drop.kind === 'place' &&
      one.drop.target.row === stacked.placements.b.row,
  );

  expect(plain).toBeDefined();
  expect(select(settled, aimAt(1, 5), plain?.drop.id)?.drop.kind).toBe('swap');
});

test('nor does it hold one against a trade it has just come within reach of', () => {
  // The pointer was over empty space a moment ago, so a plain drop is what is
  // in hand; now it has reached a widget. The plain cell is still on offer as
  // a neighbour and is nearer the hand than the slot being traded for, so
  // without a rank guard stickiness would hold it and the trade could never
  // be reached.
  const pair: GridState = {
    childIds: ['a', 'b'],
    layouts: {
      a: { col: 1, row: 1, colSpan: 4, rowSpan: 1 },
      b: { col: 9, row: 1, colSpan: 4, rowSpan: 1 },
    },
    placements: {
      a: { col: 1, row: 1, colSpan: 4, rowSpan: 1 },
      b: { col: 9, row: 1, colSpan: 4, rowSpan: 1 },
    },
    columns: 12,
  };
  const settled = candidates(pair, 'a', 'move', {
    col: 6,
    row: 1,
    colSpan: 4,
    rowSpan: 1,
  });
  // The cell one short of the one it snapped to, which touches nothing.
  const clear = settled.find(
    one => one.drop.kind === 'place' && one.drop.target.col === 5,
  );

  expect(clear).toBeDefined();
  expect(settled.some(one => one.drop.kind === 'swap')).toBe(true);
  expect(select(settled, aimAt(6, 1), clear?.drop.id)?.drop.kind).toBe('swap');
});

test('nothing is worth writing when the widget ends where it began', () => {
  const origin = stacked.placements.a;
  const chosen = chooseDrop(stacked, 'a', 'move', origin, aimAt(1, 1));

  expect(chosen).toBeDefined();
  expect(changesAnything(chosen as Settled, origin, origin)).toBe(false);
});

test('nor when it ends where it already sits, having been moved under the hand', () => {
  // A write landing mid-gesture -- a sibling's drop, or another editor --
  // moves the widget out from under the pointer. A gesture that then happens
  // to land on where it now sits has nothing to say.
  const origin = { col: 1, row: 1, colSpan: 24, rowSpan: 4 };
  const current = { col: 1, row: 5, colSpan: 24, rowSpan: 4 };
  const chosen = chooseDrop(stacked, 'a', 'move', current, aimAt(1, 5));

  expect(changesAnything(chosen as Settled, origin, current)).toBe(false);
});

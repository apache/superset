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
  COLUMN_LAYOUT_PRESETS,
  getColumnSpec,
  resolveColumnWidths,
  type ColumnSpec,
} from './columnWidths';

const fixed = (width: number): ColumnSpec => ({
  min: width,
  max: width,
  weight: 0,
});
const flex = (min: number, max: number, weight: number): ColumnSpec => ({
  min,
  max,
  weight,
});

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

test('uses minimum widths and overflows when the container is too narrow', () => {
  const specs = [fixed(48), flex(240, 480, 3), flex(140, 280, 1), fixed(120)];
  const { widths, totalWidth } = resolveColumnWidths(specs, 400);
  expect(widths).toEqual([48, 240, 140, 120]);
  expect(totalWidth).toBe(548);
});

test('uses minimum widths when the container width is unknown', () => {
  const specs = [flex(240, 480, 3), fixed(120)];
  expect(resolveColumnWidths(specs, 0)).toEqual({
    widths: [240, 120],
    totalWidth: 360,
  });
});

test('fits exactly when the container equals the sum of minimums', () => {
  const specs = [flex(240, 480, 3), flex(140, 280, 1), fixed(120)];
  expect(resolveColumnWidths(specs, 500)).toEqual({
    widths: [240, 140, 120],
    totalWidth: 500,
  });
});

test('distributes spare width by weight', () => {
  const specs = [flex(200, 1000, 3), flex(100, 1000, 1), fixed(100)];
  // 400 spare: 300 to the weight-3 column, 100 to the weight-1 column.
  const { widths, totalWidth } = resolveColumnWidths(specs, 800);
  expect(widths).toEqual([500, 200, 100]);
  expect(totalWidth).toBe(800);
});

test('caps the title at its max while other flexible columns keep growing', () => {
  const specs = [flex(240, 480, 3), flex(140, 280, 1), flex(140, 280, 1)];
  // 520 + 400 spare. Weighted shares would give the title 240 extra (480,
  // exactly its cap); the remaining 160 go to the text columns.
  const { widths } = resolveColumnWidths(specs, 920);
  expect(widths).toEqual([480, 220, 220]);

  // With more spare width the title is frozen at its cap and the rest is
  // redistributed to the uncapped columns.
  const wider = resolveColumnWidths(specs, 1040);
  expect(wider.widths).toEqual([480, 280, 280]);
  expect(wider.totalWidth).toBe(1040);
});

test('soft-overflows past max by weight once every flexible column is capped', () => {
  const specs = [flex(240, 480, 3), flex(140, 280, 1), fixed(120)];
  // Every flexible column at max = 880. 120 left: 90 / 30 by weight.
  const { widths, totalWidth } = resolveColumnWidths(specs, 1000);
  expect(widths).toEqual([570, 310, 120]);
  expect(totalWidth).toBe(1000);
});

test('keeps fixed columns constant across container widths', () => {
  const specs = [
    fixed(48),
    flex(240, 480, 3),
    fixed(96),
    flex(150, 220, 1),
    fixed(120),
  ];
  [300, 700, 1024, 1440, 1920, 2560].forEach(width => {
    const { widths } = resolveColumnWidths(specs, width);
    expect([widths[0], widths[2], widths[4]]).toEqual([48, 96, 120]);
  });
});

test('gives the rounding remainder to the highest-weight column', () => {
  const specs = [flex(100, 1000, 1), flex(100, 1000, 2), flex(100, 1000, 1)];
  // 301 spare split 1:2:1 = 75.25 / 150.5 / 75.25 -> floored 75/150/75,
  // the leftover 1px goes to the weight-2 column.
  const { widths, totalWidth } = resolveColumnWidths(specs, 601);
  expect(widths).toEqual([175, 251, 175]);
  expect(totalWidth).toBe(601);
});

test('fills the container when a selection column is included', () => {
  const specs = [
    getColumnSpec({ fixed: 48 }),
    flex(240, 480, 3),
    flex(140, 280, 1),
  ];
  [500, 1000, 1920].forEach(width => {
    const { widths, totalWidth } = resolveColumnWidths(specs, width);
    expect(widths[0]).toBe(48);
    expect(sum(widths)).toBe(Math.max(width, 428));
    expect(totalWidth).toBe(sum(widths));
  });
});

test('getColumnSpec resolves presets, explicit layouts and legacy sizes', () => {
  expect(getColumnSpec('title')).toEqual(
    getColumnSpec(COLUMN_LAYOUT_PRESETS.title),
  );
  expect(getColumnSpec({ fixed: 160 })).toEqual(fixed(160));
  expect(getColumnSpec({ min: 100 })).toEqual({
    min: 100,
    max: Infinity,
    weight: 1,
  });
  expect(getColumnSpec({ min: 100, max: 200, weight: 2 })).toEqual(
    flex(100, 200, 2),
  );
  const presetNames = Object.keys(COLUMN_LAYOUT_PRESETS) as Array<
    keyof typeof COLUMN_LAYOUT_PRESETS
  >;
  presetNames.forEach(name => {
    const spec = getColumnSpec(name);
    expect(spec.min).toBeGreaterThan(0);
    expect(spec.max).toBeGreaterThanOrEqual(spec.min);
  });
});

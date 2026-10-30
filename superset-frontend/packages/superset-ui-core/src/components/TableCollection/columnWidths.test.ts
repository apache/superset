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
  FREEZE_MAX_CONTAINER_SHARE,
  FREEZE_MIN_SCROLL_PX,
  getColumnSpec,
  getFrozenColumnCount,
  getLeadingBlockLength,
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
  const { widths, totalWidth, scrolls } = resolveColumnWidths(specs, 400);
  expect(widths).toEqual([48, 240, 140, 120]);
  expect(totalWidth).toBe(548);
  expect(scrolls).toBe(true);
});

test('uses minimum widths when the container width is unknown', () => {
  const specs = [flex(240, 480, 3), fixed(120)];
  expect(resolveColumnWidths(specs, 0)).toEqual({
    widths: [240, 120],
    totalWidth: 360,
    scrolls: true,
  });
});

test('fits exactly when the container equals the sum of minimums', () => {
  const specs = [flex(240, 480, 3), flex(140, 280, 1), fixed(120)];
  expect(resolveColumnWidths(specs, 500)).toEqual({
    widths: [240, 140, 120],
    totalWidth: 500,
    scrolls: false,
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

test('the preset table holds the measured widths', () => {
  expect(COLUMN_LAYOUT_PRESETS).toEqual({
    icon: { fixed: 48 },
    statusIcon: { fixed: 48 },
    statusIcons: { fixed: 64 },
    status: { fixed: 144 },
    flag: { fixed: 176 },
    count: { fixed: 104 },
    timer: { fixed: 136 },
    people: { fixed: 120 },
    iconList: { fixed: 120 },
    dateRelative: { fixed: 176 },
    dateTwoLine: { fixed: 136 },
    timestamp: { fixed: 240 },
    actions: { fixed: 120 },
    actionsWide: { fixed: 168 },
    title: { min: 320, max: 640, weight: 3 },
    text: { min: 140, max: 280, weight: 1 },
    identifier: { min: 180, max: 360, weight: 1 },
    longtext: { min: 200, max: 560, weight: 1.5 },
    tags: { min: 200, max: 320, weight: 1 },
  });
});

test('reports no scroll whenever the minimums fit', () => {
  const specs = [flex(320, 640, 3), fixed(120)];
  [440, 800, 2560].forEach(width =>
    expect(resolveColumnWidths(specs, width).scrolls).toBe(false),
  );
  expect(resolveColumnWidths(specs, 439).scrolls).toBe(true);
});

test('the leading block is the title plus the icon columns before it', () => {
  expect(getLeadingBlockLength(['icon', 'title', 'text', 'actions'])).toBe(2);
  expect(getLeadingBlockLength(['title', 'dateRelative'])).toBe(1);
  expect(getLeadingBlockLength(['statusIcon', 'title'])).toBe(2);
  expect(getLeadingBlockLength([{ fixed: 48 }, 'title'])).toBe(0);
});

test('there is no leading block when the title is not led by icons only', () => {
  // Alerts: state icon and "Last run" precede the name.
  expect(getLeadingBlockLength(['statusIcon', 'timestamp', 'title'])).toBe(0);
  // Users: first and last name precede the username.
  expect(getLeadingBlockLength(['text', 'text', 'title'])).toBe(0);
  // Query history has no title column.
  expect(getLeadingBlockLength(['statusIcon', 'dateTwoLine', 'text'])).toBe(0);
});

test('freezes the leading block only when the table scrolls', () => {
  const widths = [48, 320, 400, 400];
  expect(
    getFrozenColumnCount({
      widths,
      leadingCount: 2,
      containerWidth: 1000,
      scrolls: true,
    }),
  ).toBe(2);
  expect(
    getFrozenColumnCount({
      widths,
      leadingCount: 2,
      containerWidth: 1168,
      scrolls: false,
    }),
  ).toBe(0);
  expect(
    getFrozenColumnCount({
      widths,
      leadingCount: 0,
      containerWidth: 1000,
      scrolls: true,
    }),
  ).toBe(0);
});

test('does not freeze a leading block wider than half the container', () => {
  const widths = [48, 48, 320, 400, 400];
  // 416px frozen: fits in 832 (exactly half) but not in 831.
  const frozenAt = (containerWidth: number) =>
    getFrozenColumnCount({
      widths,
      leadingCount: 3,
      containerWidth,
      scrolls: true,
    });
  expect(FREEZE_MAX_CONTAINER_SHARE).toBe(0.5);
  expect(frozenAt(832)).toBe(3);
  expect(frozenAt(831)).toBe(0);
});

test('does not freeze unless enough of the container is left to scroll', () => {
  expect(FREEZE_MIN_SCROLL_PX).toBe(240);
  // 200px frozen is under half of 439 but leaves only 239px to scroll.
  const frozenAt = (containerWidth: number) =>
    getFrozenColumnCount({
      widths: [200, 400],
      leadingCount: 1,
      containerWidth,
      scrolls: true,
    });
  expect(frozenAt(439)).toBe(0);
  expect(frozenAt(440)).toBe(1);
});

test('does not freeze when the container width is unknown', () => {
  expect(
    getFrozenColumnCount({
      widths: [48, 320, 400],
      leadingCount: 2,
      containerWidth: 0,
      scrolls: true,
    }),
  ).toBe(0);
});

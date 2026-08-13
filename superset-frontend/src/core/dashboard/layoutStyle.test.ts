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
import { supersetTheme } from '@apache-superset/core/theme';
import {
  cellAtPoint,
  pixelRectForCell,
  resolveCellGeometry,
  resolveGridMetrics,
} from './layoutStyle';

const theme = supersetTheme as unknown as Parameters<
  typeof resolveGridMetrics
>[1];

test('a container with no layout still resolves default grid metrics', () => {
  expect(resolveGridMetrics(undefined, theme)).toEqual({
    columns: 24,
    gap: 16,
    rowUnitPx: theme.sizeUnit * 8,
  });
});

test('a container names its own columns, gap and row height', () => {
  expect(
    resolveGridMetrics({ columns: 12, gap: 24, rowUnit: 40 }, theme),
  ).toEqual({ columns: 12, gap: 24, rowUnitPx: 40 });
});

test('resolveCellGeometry divides the container width evenly across columns, and halves gap into a per-side margin', () => {
  expect(
    resolveCellGeometry({ columns: 24, gap: 16, rowUnitPx: 32 }, 1200),
  ).toEqual({ columnWidthPx: 50, cellHeightPx: 48, marginPx: 8 });
});

test('cellAtPoint converts a pixel offset into the fractional column/row it falls on', () => {
  const cell = resolveCellGeometry(
    { columns: 24, gap: 16, rowUnitPx: 32 },
    1200,
  );

  expect(cellAtPoint(125, 96, cell)).toEqual({ col: 2.5, row: 2 });
});

test('pixelRectForCell insets each side by half of gap, so two adjacent cells read as gap apart', () => {
  const cell = resolveCellGeometry(
    { columns: 24, gap: 16, rowUnitPx: 32 },
    1200,
  );

  const left = pixelRectForCell({ x: 0, y: 0, w: 2, h: 1 }, cell);
  const right = pixelRectForCell({ x: 2, y: 0, w: 2, h: 1 }, cell);

  expect(left).toEqual({ left: 8, top: 8, width: 84, height: 32 });
  expect(right).toEqual({ left: 108, top: 8, width: 84, height: 32 });
  // left's own right edge to right's own left edge is exactly `gap` apart.
  expect(right.left - (left.left + left.width)).toBe(16);
});

test('pixelRectForCell matches the height react-grid-layout used to produce, for the same rowUnit/gap', () => {
  const cell = resolveCellGeometry(
    { columns: 24, gap: 16, rowUnitPx: 32 },
    1200,
  );

  // react-grid-layout's own formula was h*rowUnitPx + (h-1)*gap.
  const h = 8;
  const rglHeight = h * 32 + (h - 1) * 16;

  expect(pixelRectForCell({ x: 0, y: 0, w: 1, h }, cell).height).toBe(
    rglHeight,
  );
});

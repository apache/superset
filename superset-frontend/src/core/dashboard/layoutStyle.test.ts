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
  resolveFlexBasis,
  resolveFlexMetrics,
  resolveGridMetrics,
  resolveLayoutMode,
} from './layoutStyle';

const theme = supersetTheme as unknown as Parameters<
  typeof resolveGridMetrics
>[1];

test('a container that names no mode is a grid', () => {
  // The whole of the back-compatibility story: every node authored before
  // the field existed, and every AI tool call that still omits it, arranges
  // exactly as it did.
  expect(resolveLayoutMode(undefined)).toBe('grid');
  expect(resolveLayoutMode({ columns: 12 })).toBe('grid');
});

test('a container that names a mode gets it', () => {
  expect(resolveLayoutMode({ mode: 'free' })).toBe('free');
  expect(resolveLayoutMode({ mode: 'flex' })).toBe('flex');
});

test('flex maps the schema names to CSS rather than forwarding them', () => {
  const metrics = resolveFlexMetrics(
    {
      mode: 'flex',
      direction: 'column',
      justify: 'space-between',
      align: 'center',
    },
    theme,
  );

  // `start` is the schema's word and `flex-start` is CSS's. A stored layout
  // never holds a raw CSS keyword the renderer merely passes through.
  expect(metrics.flexDirection).toBe('column');
  expect(metrics.justifyContent).toBe('space-between');
  expect(metrics.alignItems).toBe('center');
});

test('flex falls back rather than letting an unknown value reach the style', () => {
  const metrics = resolveFlexMetrics(
    { justify: 'sideways' as never, align: 'diagonal' as never },
    theme,
  );

  expect(metrics.justifyContent).toBe('flex-start');
  expect(metrics.alignItems).toBe('stretch');
});

test('flex wraps unless told not to', () => {
  expect(resolveFlexMetrics({}, theme).flexWrap).toBe('wrap');
  expect(resolveFlexMetrics({ wrap: false }, theme).flexWrap).toBe('nowrap');
});

test('gap and row height survive a change of mode', () => {
  // Switching how a container arranges its children should not change how
  // far apart or how tall they are.
  const layout = { gap: 24, rowUnit: 40 };

  expect(resolveFlexMetrics(layout, theme).gap).toBe(
    resolveGridMetrics(layout, theme).gap,
  );
  expect(resolveFlexMetrics(layout, theme).rowUnitPx).toBe(
    resolveGridMetrics(layout, theme).rowUnitPx,
  );
});

test('a flex child that was sized takes that share of the line', () => {
  expect(resolveFlexBasis({ colSpan: 12 }, 24, 2)).toBe('50%');
  expect(resolveFlexBasis({ colSpan: 6 }, 24, 4)).toBe('25%');
});

test('a flex child that was never sized takes an equal share, not its content', () => {
  // The things a dashboard arranges have no intrinsic width — a chart fills
  // whatever box it is handed — so content sizing draws a row of four
  // sections as four slivers.
  expect(resolveFlexBasis(undefined, 24, 4)).toBe('25%');
  expect(resolveFlexBasis({ rowSpan: 3 }, 24, 3)).toBe(`${100 / 3}%`);
});

test('a flex child cannot claim more of the line than there is', () => {
  expect(resolveFlexBasis({ colSpan: 99 }, 24, 2)).toBe('100%');
});

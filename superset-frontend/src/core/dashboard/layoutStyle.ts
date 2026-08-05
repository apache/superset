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
import type { dashboard as dashboardApi } from '@apache-superset/core';
import type { useTheme } from '@apache-superset/core/theme';

type LayoutProps = dashboardApi.LayoutProps;
type LayoutMode = dashboardApi.LayoutMode;
type Theme = ReturnType<typeof useTheme>;

/** Column count a container falls back to when its layout omits `columns`. */
export const DEFAULT_COLUMNS = 24;

const DEFAULT_GAP = 16;

/**
 * The mode a container arranges its children in.
 *
 * Absent means `grid`, and that is the whole of the back-compatibility story:
 * every node authored before the field existed, and every AI tool call that
 * still omits it, keeps arranging exactly as it did.
 */
export function resolveLayoutMode(layout: LayoutProps | undefined): LayoutMode {
  return layout?.mode ?? 'grid';
}

/** A container's resolved grid geometry, in the plain numbers `CanvasBlock` feeds to `react-grid-layout` (`cols`/`rowHeight`/`margin`). */
export interface GridMetrics {
  columns: number;
  gap: number;
  rowUnitPx: number;
}

/**
 * Resolves a container's grid geometry, applying the same defaults every
 * consumer of a node's `layout` needs to agree on — `rowUnit` falls back to
 * a size derived from the theme rather than a bare literal, since it's meant
 * to track the app's own spacing scale, not an arbitrary pixel value.
 */
export function resolveGridMetrics(
  layout: LayoutProps | undefined,
  theme: Theme,
): GridMetrics {
  return {
    columns: layout?.columns ?? DEFAULT_COLUMNS,
    gap: layout?.gap ?? DEFAULT_GAP,
    rowUnitPx: layout?.rowUnit ?? theme.sizeUnit * 8,
  };
}

/** The CSS a `flex` container lays its own children out with. */
export interface FlexMetrics {
  flexDirection: 'row' | 'column';
  flexWrap: 'wrap' | 'nowrap';
  justifyContent: string;
  alignItems: string;
  gap: number;
  rowUnitPx: number;
}

const JUSTIFY: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  'space-between': 'space-between',
  'space-around': 'space-around',
};

const ALIGN: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
};

/**
 * Resolves a `flex` container's geometry.
 *
 * The names in the schema are mapped here rather than forwarded, so the
 * stored layout never holds a raw CSS keyword the renderer merely passes
 * through — `start` is the schema's word and `flex-start` is CSS's, and an
 * unrecognised value falls back rather than reaching the style attribute.
 *
 * `gap` and `rowUnit` are shared with the grid modes on purpose: switching a
 * container's mode should change how its children are arranged, not how far
 * apart or how tall they are.
 */
export function resolveFlexMetrics(
  layout: LayoutProps | undefined,
  theme: Theme,
): FlexMetrics {
  return {
    flexDirection: layout?.direction === 'column' ? 'column' : 'row',
    flexWrap: layout?.wrap === false ? 'nowrap' : 'wrap',
    justifyContent: JUSTIFY[layout?.justify ?? 'start'] ?? 'flex-start',
    alignItems: ALIGN[layout?.align ?? 'stretch'] ?? 'stretch',
    gap: layout?.gap ?? DEFAULT_GAP,
    rowUnitPx: layout?.rowUnit ?? theme.sizeUnit * 8,
  };
}

/**
 * A `flex` child's share of the line, as a CSS `flex-basis` percentage.
 *
 * A child that was never sized takes an equal share rather than being sized
 * by its content: the things a dashboard arranges have no intrinsic width —
 * a chart fills whatever box it is handed — so content sizing resolves to no
 * width at all, and a row of four sections draws as four slivers.
 */
export function resolveFlexBasis(
  layout: LayoutProps | undefined,
  columns: number,
  siblings: number,
): string {
  const span = layout?.colSpan;
  if (span == null) {
    return `${100 / Math.max(1, siblings)}%`;
  }
  return `${(Math.min(span, columns) / columns) * 100}%`;
}

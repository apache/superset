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
import type { PackedRect } from './gridPacking';

type LayoutProps = dashboardApi.LayoutProps;
type Theme = ReturnType<typeof useTheme>;

/** Column count a container falls back to when its layout omits `columns`. */
export const DEFAULT_COLUMNS = 24;

const DEFAULT_GAP = 16;

/** A container's resolved grid geometry, in the plain numbers `RootGrid` feeds to the grid engine (column count / row pixel height / gap). */
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

/**
 * `GridMetrics` translated into actual on-screen pixels for one cell —
 * `columnWidthPx` depends on the container's own rendered width (columns are
 * fractional tracks, so this can't be resolved from `GridMetrics` alone),
 * `cellHeightPx` is a fixed row-track-plus-gap height, and `marginPx` is
 * half of `gap`: the grid engine insets a cell's own content by its margin
 * on *every* side, so two adjacent cells — each contributing one inset —
 * end up `gap` apart in total, not `2 * gap`.
 */
export interface CellGeometry {
  columnWidthPx: number;
  cellHeightPx: number;
  marginPx: number;
}

/** Resolves one cell's actual pixel dimensions from a container's grid metrics and its current rendered width. */
export function resolveCellGeometry(
  metrics: GridMetrics,
  containerWidthPx: number,
): CellGeometry {
  return {
    columnWidthPx: containerWidthPx / metrics.columns,
    cellHeightPx: metrics.rowUnitPx + metrics.gap,
    marginPx: metrics.gap / 2,
  };
}

/**
 * Converts a pointer position — already relative to the grid container's
 * own top-left corner, in pixels — into the fractional column/row it falls
 * on. Fractional, not floored: `resolveDropPlacement` (`gridPacking.ts`)
 * needs the fraction to tell which half of a target widget the pointer is
 * actually nearer to, not just which cell it's over.
 */
export function cellAtPoint(
  offsetXPx: number,
  offsetYPx: number,
  cell: CellGeometry,
): { col: number; row: number } {
  return {
    col: offsetXPx / cell.columnWidthPx,
    row: offsetYPx / cell.cellHeightPx,
  };
}

/**
 * The on-screen pixel rect a `PackedRect` occupies — the inverse of
 * `cellAtPoint`, and the other half of the same cell geometry every grid
 * item is positioned with (see `CellGeometry`'s own doc comment for the
 * margin/2 reasoning). The drop ghost is the one thing here that needs
 * this: it isn't a real grid widget, so nothing positions it but this.
 */
export function pixelRectForCell(
  rect: PackedRect,
  cell: CellGeometry,
): { left: number; top: number; width: number; height: number } {
  return {
    left: rect.x * cell.columnWidthPx + cell.marginPx,
    top: rect.y * cell.cellHeightPx + cell.marginPx,
    width: rect.w * cell.columnWidthPx - 2 * cell.marginPx,
    height: rect.h * cell.cellHeightPx - 2 * cell.marginPx,
  };
}

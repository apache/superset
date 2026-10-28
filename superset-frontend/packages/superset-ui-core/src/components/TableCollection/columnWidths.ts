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
 * Column width model shared by every list view table.
 *
 * Neither antd nor react-table can express "flex between a min and a max", so
 * widths are resolved here from the measured container width and handed to
 * antd as explicit pixel widths with a fixed table layout.
 */

export type ColumnLayoutPreset =
  | 'icon'
  | 'status'
  | 'statusWide'
  | 'count'
  | 'people'
  | 'actions'
  | 'actionsWide'
  | 'date'
  | 'title'
  | 'text'
  | 'longtext'
  | 'tags';

export type FixedColumnLayout = { fixed: number };
export type FlexColumnLayout = { min: number; max?: number; weight?: number };

export type ColumnLayout =
  | ColumnLayoutPreset
  | FixedColumnLayout
  | FlexColumnLayout;

/**
 * Single source of truth for list view column widths, in pixels.
 *
 * Fixed presets are for content that always fits a known width; flexible
 * presets start at `min`, share spare width by `weight` and stop growing at
 * `max` until every flexible column has reached its max.
 *
 * - icon: favorite star, kind icon
 * - status: status/state badges, active and boolean flags, small enums
 * - statusWide: status-like content under a header too long for `status`
 *   (e.g. "Expose in SQL Lab", "Notification method")
 * - count: rows, durations, ids and counts (sized for headers such as
 *   "Dashboard Id" and the query duration timer label)
 * - people: owner/editor/viewer avatar groups
 * - actions: hover action icons (up to four)
 * - actionsWide: hover action icons (five or six)
 * - date: "Last modified" style relative times, optionally with an avatar
 * - title: the primary identifier of a row (name/title)
 * - text: database, schema, dataset, backend, user names and similar
 * - longtext: description, SQL, clause, error message, JSON payload
 * - tags: tag chips and other chip lists
 */
export const COLUMN_LAYOUT_PRESETS: Record<
  ColumnLayoutPreset,
  FixedColumnLayout | Required<FlexColumnLayout>
> = {
  icon: { fixed: 48 },
  status: { fixed: 112 },
  statusWide: { fixed: 168 },
  count: { fixed: 136 },
  people: { fixed: 140 },
  actions: { fixed: 120 },
  actionsWide: { fixed: 168 },
  date: { min: 150, max: 220, weight: 1 },
  title: { min: 240, max: 480, weight: 2 },
  text: { min: 140, max: 280, weight: 1 },
  longtext: { min: 200, max: 560, weight: 1.5 },
  tags: { min: 160, max: 320, weight: 1 },
};

/** Width of antd's row-selection and row-expand columns in managed tables. */
export const UTILITY_COLUMN_WIDTH = 48;

type TableSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl';

/** Legacy `size` tokens, each treated as a fixed width. */
export const COLUMN_SIZE_MAP: Record<TableSize, number> = {
  xs: 25,
  sm: 50,
  md: 75,
  lg: 100,
  xl: 150,
  xxl: 200,
  xxxl: 360,
};

export interface ColumnSpec {
  min: number;
  max: number;
  /** Share of spare width; 0 for fixed columns. */
  weight: number;
}

export function getColumnSpec(layout: ColumnLayout): ColumnSpec {
  const resolved =
    typeof layout === 'string' ? COLUMN_LAYOUT_PRESETS[layout] : layout;
  if ('fixed' in resolved) {
    return { min: resolved.fixed, max: resolved.fixed, weight: 0 };
  }
  return {
    min: resolved.min,
    max: resolved.max ?? Infinity,
    weight: resolved.weight ?? 1,
  };
}

/**
 * Resolves the layout of a list view column: an explicit `layout` wins, then
 * a legacy `size` token (fixed), then `actions` for the actions column and
 * `text` for everything else.
 */
export function getColumnLayout(column: {
  id?: string;
  layout?: ColumnLayout;
  size?: string;
}): ColumnLayout {
  if (column.layout) return column.layout;
  const legacyWidth = column.size
    ? COLUMN_SIZE_MAP[column.size as TableSize]
    : undefined;
  if (legacyWidth) return { fixed: legacyWidth };
  return column.id === 'actions' ? 'actions' : 'text';
}

/**
 * Resolves pixel widths for `specs` within `containerWidth`.
 *
 * Every column starts at its min. Spare width is shared by weight among
 * flexible columns, each clamped to its max; once every flexible column is at
 * its max the remainder is shared by weight beyond max so the table still
 * fills the container. When the container is narrower than the sum of minimums
 * (or unknown) the minimums are used and the table scrolls horizontally.
 */
export function resolveColumnWidths(
  specs: ColumnSpec[],
  containerWidth: number,
): { widths: number[]; totalWidth: number } {
  const widths = specs.map(spec => spec.min);
  const minTotal = widths.reduce((total, width) => total + width, 0);
  const flexIndexes = specs
    .map((spec, index) => (spec.weight > 0 ? index : -1))
    .filter(index => index >= 0);
  let spare = containerWidth - minTotal;
  if (spare <= 0 || flexIndexes.length === 0) {
    return { widths, totalWidth: minTotal };
  }

  let growing = flexIndexes.filter(index => specs[index].max > widths[index]);
  while (spare > 0 && growing.length > 0) {
    const totalWeight = growing.reduce((t, i) => t + specs[i].weight, 0);
    const capped = growing.filter(
      index =>
        widths[index] + (spare * specs[index].weight) / totalWeight >=
        specs[index].max,
    );
    if (capped.length === 0) {
      const available = spare;
      growing.forEach(index => {
        widths[index] += (available * specs[index].weight) / totalWeight;
      });
      spare = 0;
    } else {
      capped.forEach(index => {
        spare -= specs[index].max - widths[index];
        widths[index] = specs[index].max;
      });
      growing = growing.filter(index => !capped.includes(index));
    }
  }

  if (spare > 0) {
    const totalWeight = flexIndexes.reduce((t, i) => t + specs[i].weight, 0);
    const available = spare;
    flexIndexes.forEach(index => {
      widths[index] += (available * specs[index].weight) / totalWeight;
    });
  }

  const floored = widths.map(Math.floor);
  const remainder =
    containerWidth - floored.reduce((total, width) => total + width, 0);
  const heaviest = flexIndexes.reduce((best, index) =>
    specs[index].weight > specs[best].weight ? index : best,
  );
  floored[heaviest] += remainder;
  return { widths: floored, totalWidth: containerWidth };
}

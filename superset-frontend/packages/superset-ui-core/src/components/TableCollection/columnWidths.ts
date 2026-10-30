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
  | 'statusIcon'
  | 'statusIcons'
  | 'status'
  | 'flag'
  | 'count'
  | 'timer'
  | 'people'
  | 'iconList'
  | 'dateRelative'
  | 'dateTwoLine'
  | 'timestamp'
  | 'actions'
  | 'actionsWide'
  | 'title'
  | 'text'
  | 'identifier'
  | 'longtext'
  | 'tags';

export type FixedColumnLayout = { fixed: number };
export type FlexColumnLayout = { min: number; max?: number; weight?: number };

export type ColumnLayout =
  | ColumnLayoutPreset
  | FixedColumnLayout
  | FlexColumnLayout;

/**
 * Single source of truth for list view column widths, in pixels, including
 * the 24px of cell padding.
 *
 * Fixed presets are for content whose width is known up front; they never
 * change with the viewport. Flexible presets start at `min`, share spare width
 * by `weight` and stop growing at `max` until every flexible column has
 * reached its max. Widths were measured on rendered cells with English and
 * German strings (the longest common UI translation).
 */
export const COLUMN_LAYOUT_PRESETS: Record<
  ColumnLayoutPreset,
  FixedColumnLayout | Required<FlexColumnLayout>
> = {
  /** Favorite star or a single icon: 20px icon + padding. */
  icon: { fixed: 48 },
  /** One state icon (query, alert or task state). */
  statusIcon: { fixed: 48 },
  /**
   * A row of indicator icons (task details): up to four 16px icons 8px apart,
   * the last with a reuse count ("+999"), measured at 118 + padding.
   */
  statusIcons: { fixed: 144 },
  /**
   * A badge: Published/Draft, Physical/Virtual/Semantic View, task scope.
   * German badges ("Veröffentlicht", "Semantische Ansicht") need 144.
   */
  status: { fixed: 144 },
  /**
   * A boolean flag (check mark, switch, Yes/No). The content is tiny, so the
   * width is set by the header; longer headers ellipsize with a tooltip.
   */
  flag: { fixed: 176 },
  /** A plain number: rows, ids, counts and durations as text. */
  count: { fixed: 104 },
  /** A monospace duration timer badge (needs 132). */
  timer: { fixed: 136 },
  /** Owner/editor/viewer avatar group (up to four avatars + "+N"). */
  people: { fixed: 120 },
  /** A short row of icons (notification recipients). */
  iconList: { fixed: 120 },
  /**
   * "3 months ago" style relative date, or a short date without a time
   * ("Oct 29, 2026", "29. Okt. 2026"); German strings such as
   * "vor ein paar Sekunden" need 176.
   */
  dateRelative: { fixed: 176 },
  /** A date over a time on two lines. */
  dateTwoLine: { fixed: 136 },
  /**
   * An absolute date and time such as "2026-10-29 14:03:12+00:00" (action
   * log, alert runs, execution log, user dates).
   */
  timestamp: { fixed: 240 },
  /** Hover action icons, up to four (24px per icon + 24px). */
  actions: { fixed: 120 },
  /**
   * Hover action icons, five or six (e.g. databases with OAuth2 tokens: five
   * icons end flush with a 120px cell and need 144).
   */
  actionsWide: { fixed: 168 },
  /**
   * The primary name of a row. The one main flexible column: wide enough for
   * nearly all real titles at its min, and the largest share of spare width.
   * Titles that carry trailing tags (themes) need at least 280.
   */
  title: { min: 320, max: 640, weight: 3 },
  /** Short free text: user names, labels, chart types, keys. */
  text: { min: 140, max: 280, weight: 1 },
  /**
   * Names of databases, schemas, tables and datasets, which are often long
   * unbroken identifiers (p95 ~335px).
   */
  identifier: { min: 180, max: 360, weight: 1 },
  /** Descriptions, SQL, clauses, error messages, JSON. */
  longtext: { min: 200, max: 560, weight: 1.5 },
  /** Tag chips (at most three + "+N") and other chip or name lists. */
  tags: { min: 200, max: 320, weight: 1 },
};

/**
 * The leading block (selection checkbox, favorite star and title) is frozen
 * while the table scrolls horizontally only if it takes at most this share of
 * the container...
 */
export const FREEZE_MAX_CONTAINER_SHARE = 0.5;

/** ...and leaves at least this many pixels for the scrolling columns. */
export const FREEZE_MIN_SCROLL_PX = 240;

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
 * (or unknown) the minimums are used and `scrolls` is true: the table scrolls
 * horizontally.
 */
export function resolveColumnWidths(
  specs: ColumnSpec[],
  containerWidth: number,
): { widths: number[]; totalWidth: number; scrolls: boolean } {
  const widths = specs.map(spec => spec.min);
  const minTotal = widths.reduce((total, width) => total + width, 0);
  const flexIndexes = specs
    .map((spec, index) => (spec.weight > 0 ? index : -1))
    .filter(index => index >= 0);
  let spare = containerWidth - minTotal;
  if (spare < 0 || containerWidth <= 0) {
    return { widths, totalWidth: minTotal, scrolls: true };
  }
  if (spare === 0 || flexIndexes.length === 0) {
    return { widths, totalWidth: minTotal, scrolls: false };
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
  // The rounding remainder goes to the heaviest column with room below its
  // max (any heaviest column once all are capped and overflowing anyway).
  const byWeight = [...flexIndexes].sort(
    (a, b) => specs[b].weight - specs[a].weight,
  );
  const target =
    byWeight.find(index => floored[index] + remainder <= specs[index].max) ??
    byWeight[0];
  floored[target] += remainder;
  return { widths: floored, totalWidth: containerWidth, scrolls: false };
}

const LEADING_ICON_PRESETS: ColumnLayout[] = ['icon', 'statusIcon'];

/**
 * Number of leading columns that form the block to freeze: the `title`
 * column plus any icon columns before it (e.g. the favorite star). 0 when the
 * title is preceded by anything else, since antd can only freeze a
 * contiguous run of columns from the start and freezing those would hide
 * more than the row's name.
 *
 * The primary name column is identified by the `title` preset only: a column
 * with a custom `{ min, max }` or `{ fixed }` layout is never frozen, so a
 * row's name column must use `layout: 'title'` to stay in view.
 */
export function getLeadingBlockLength(layouts: ColumnLayout[]): number {
  const titleIndex = layouts.indexOf('title');
  if (titleIndex < 0) return 0;
  const ledByIcons = layouts
    .slice(0, titleIndex)
    .every(layout => LEADING_ICON_PRESETS.includes(layout));
  return ledByIcons ? titleIndex + 1 : 0;
}

/**
 * Number of leading columns to freeze: all `leadingCount` columns when the
 * table scrolls horizontally and the frozen block takes at most
 * FREEZE_MAX_CONTAINER_SHARE of the container while leaving at least
 * FREEZE_MIN_SCROLL_PX for the rest; otherwise 0 and the table scrolls as a
 * whole.
 */
export function getFrozenColumnCount({
  widths,
  leadingCount,
  containerWidth,
  scrolls,
}: {
  widths: number[];
  leadingCount: number;
  containerWidth: number;
  scrolls: boolean;
}): number {
  if (!scrolls || leadingCount <= 0 || containerWidth <= 0) return 0;
  const frozenWidth = widths
    .slice(0, leadingCount)
    .reduce((total, width) => total + width, 0);
  const fits =
    frozenWidth <= containerWidth * FREEZE_MAX_CONTAINER_SHARE &&
    containerWidth - frozenWidth >= FREEZE_MIN_SCROLL_PX;
  return fits ? leadingCount : 0;
}

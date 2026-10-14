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
 * Collapsible row and column groups, like Excel's Data > Group. Univer's own
 * outline is a paid add-on, so groups are kept here and collapsing a group
 * hides its rows or columns. This file has the pure logic and
 * univer/outline.ts the buttons in the sheet.
 */

/** Rows or columns `start` to `end` (inclusive), 0-based. */
export interface OutlineGroup {
  start: number;
  end: number;
  collapsed?: boolean;
}

export interface Outline {
  rows: OutlineGroup[];
  columns: OutlineGroup[];
}

export type OutlineDimension = keyof Outline;

export const EMPTY_OUTLINE: Outline = { rows: [], columns: [] };

/**
 * Groups the user makes with Group rows / Group columns. Turned off while
 * they clash with the automatic grouping ("Group rows by dimensions"): no
 * menu items, and saved ones are ignored. The code is kept to turn back on.
 */
export const MANUAL_GROUPS = false;

// width of the margin in the headers for one level of groups
export const OUTLINE_LEVEL_SIZE = 14;

/** Width of the margin in the headers for `depth` levels of groups. */
export const outlineMargin = (depth: number) =>
  depth ? depth * OUTLINE_LEVEL_SIZE + 2 : 0;

const contains = (outer: OutlineGroup, inner: OutlineGroup) =>
  outer.start <= inner.start && inner.end <= outer.end;

const overlaps = (a: OutlineGroup, b: OutlineGroup) =>
  a.start <= b.end && b.start <= a.end;

/** Groups from outermost to innermost, then top to bottom. */
export function sortGroups(groups: OutlineGroup[]): OutlineGroup[] {
  return [...groups].sort(
    (a, b) => a.start - b.start || b.end - b.start - (a.end - a.start),
  );
}

/** Nesting level of each group of `groups` (0 for a group in no other). */
export function groupLevels(groups: OutlineGroup[]): number[] {
  return groups.map(
    group =>
      groups.filter(
        other =>
          other !== group &&
          contains(other, group) &&
          !(other.start === group.start && other.end === group.end),
      ).length,
  );
}

/** How many levels of groups there are. */
export function outlineDepth(groups: OutlineGroup[]): number {
  return groups.length ? Math.max(...groupLevels(groups)) + 1 : 0;
}

/**
 * Adds a group, or returns null when it would cross another group (groups
 * nest like Excel's: one inside the other, or apart) or already exists.
 */
export function addGroup(
  groups: OutlineGroup[],
  start: number,
  end: number,
): OutlineGroup[] | null {
  const group = { start: Math.min(start, end), end: Math.max(start, end) };
  const crosses = groups.some(
    other =>
      (other.start === group.start && other.end === group.end) ||
      (overlaps(other, group) &&
        !contains(other, group) &&
        !contains(group, other)),
  );
  return crosses ? null : sortGroups([...groups, group]);
}

/**
 * Removes the groups inside rows (or columns) `start` to `end`, or when there
 * are none, the innermost group around them. Returns the groups left and the
 * ones removed.
 */
export function removeGroups(
  groups: OutlineGroup[],
  start: number,
  end: number,
): { groups: OutlineGroup[]; removed: OutlineGroup[] } {
  const selection = { start: Math.min(start, end), end: Math.max(start, end) };
  let removed = groups.filter(group => contains(selection, group));
  if (!removed.length) {
    const around = groups.filter(group => contains(group, selection));
    const innermost = around.sort(
      (a, b) => a.end - a.start - (b.end - b.start),
    )[0];
    removed = innermost ? [innermost] : [];
  }
  return {
    groups: groups.filter(group => !removed.includes(group)),
    removed,
  };
}

/** Rows (or columns) hidden by collapsed groups. */
export function hiddenIndexes(groups: OutlineGroup[]): Set<number> {
  const hidden = new Set<number>();
  groups
    .filter(group => group.collapsed)
    .forEach(group => {
      for (let i = group.start; i <= group.end; i += 1) hidden.add(i);
    });
  return hidden;
}

/** Updates the groups after `count` rows (or columns) were inserted at `at`. */
export function insertIndexes(
  groups: OutlineGroup[],
  at: number,
  count: number,
): OutlineGroup[] {
  return groups.map(group => ({
    ...group,
    start: group.start >= at ? group.start + count : group.start,
    end: group.end >= at ? group.end + count : group.end,
  }));
}

/** Updates the groups after rows (or columns) `start` to `end` were removed. */
export function removeIndexes(
  groups: OutlineGroup[],
  start: number,
  end: number,
): OutlineGroup[] {
  const count = end - start + 1;
  const shift = (i: number) => {
    if (i < start) return i;
    return i > end ? i - count : start;
  };
  return groups
    .filter(group => !(group.start >= start && group.end <= end))
    .map(group => {
      const groupStart = shift(group.start);
      // the end of a group that lost its last rows moves to the row before
      const groupEnd = group.end > end ? group.end - count : start - 1;
      return { ...group, start: groupStart, end: groupEnd };
    })
    .filter(group => group.end >= group.start);
}

/**
 * Where a group starts or ends in the saved chart: by the values of the row
 * (or the header of the column) inside the query result, so a data refresh
 * that adds or removes rows keeps groups on the same data; by position
 * otherwise, counted from the end of the query result when after it.
 */
export type OutlineAnchor =
  | { key: string }
  | { index: number }
  | { after: number };

export interface SavedOutlineGroup {
  start: OutlineAnchor;
  end: OutlineAnchor;
  collapsed?: boolean;
}

export interface SavedOutline {
  rows: SavedOutlineGroup[];
  columns: SavedOutlineGroup[];
}

type GridValue = string | number | boolean | null;

const keyText = (values: GridValue[]) =>
  values.map(value => (value === null ? '' : String(value))).join('\u0001');

/**
 * Identifies the data rows and columns of the query result: a row by its
 * first `keyColumns` values (the dimensions), a column by its headers.
 */
export function outlineKeys(
  grid: GridValue[][],
  headerRows: number,
  keyColumns?: number,
): { rows: (string | null)[]; columns: (string | null)[] } {
  const cols = grid[0]?.length ?? 0;
  return {
    rows: grid.map((row, r) =>
      r < headerRows ? null : keyText(row.slice(0, keyColumns || cols)),
    ),
    columns: Array.from({ length: cols }, (_, c) =>
      keyText(grid.slice(0, headerRows).map(row => row[c])),
    ),
  };
}

function anchorGroups(
  groups: OutlineGroup[],
  keys: (string | null)[],
): SavedOutlineGroup[] {
  const anchor = (i: number): OutlineAnchor => {
    if (i >= keys.length) return { after: i - keys.length };
    const key = keys[i];
    // a key that isn't unique can't tell rows apart
    return key !== null && keys.indexOf(key) === keys.lastIndexOf(key)
      ? { key }
      : { index: i };
  };
  return groups.map(group => ({
    start: anchor(group.start),
    end: anchor(group.end),
    ...(group.collapsed ? { collapsed: true } : {}),
  }));
}

function resolveGroups(
  groups: SavedOutlineGroup[],
  keys: (string | null)[],
): OutlineGroup[] {
  const resolve = (anchor: OutlineAnchor) => {
    if ('key' in anchor) {
      const i = keys.indexOf(anchor.key);
      return i < 0 ? null : i;
    }
    if ('after' in anchor) return keys.length + anchor.after;
    return anchor.index;
  };
  return groups.reduce<OutlineGroup[]>((result, saved) => {
    const start = resolve(saved.start);
    const end = resolve(saved.end);
    if (start === null || end === null) return result;
    const added = addGroup(result, start, end);
    if (!added) return result;
    return added.map(group =>
      group.start === Math.min(start, end) &&
      group.end === Math.max(start, end) &&
      saved.collapsed
        ? { ...group, collapsed: true }
        : group,
    );
  }, []);
}

/** The outline as saved with the chart. */
export function anchorOutline(
  outline: Outline,
  grid: GridValue[][],
  headerRows: number,
  keyColumns?: number,
): SavedOutline {
  const keys = outlineKeys(grid, headerRows, keyColumns);
  return {
    rows: anchorGroups(outline.rows, keys.rows),
    columns: anchorGroups(outline.columns, keys.columns),
  };
}

/** The saved outline on the current query result. */
export function resolveOutline(
  saved: SavedOutline | null | undefined,
  grid: GridValue[][],
  headerRows: number,
  keyColumns?: number,
): Outline {
  if (!saved) return EMPTY_OUTLINE;
  const keys = outlineKeys(grid, headerRows, keyColumns);
  return {
    rows: resolveGroups(saved.rows ?? [], keys.rows),
    columns: resolveGroups(saved.columns ?? [], keys.columns),
  };
}

/**
 * The automatic groups (see groupRows in workbook.ts) together with the
 * saved ones: an automatic group the user collapsed stays collapsed, groups
 * the user added are kept where they don't cross the automatic ones.
 */
export function combineGroups(
  automatic: OutlineGroup[],
  saved: OutlineGroup[],
): OutlineGroup[] {
  return saved.reduce<OutlineGroup[]>((groups, group) => {
    const same = groups.findIndex(
      other => other.start === group.start && other.end === group.end,
    );
    if (same >= 0) {
      return groups.map((other, i) =>
        i === same ? { ...other, collapsed: group.collapsed } : other,
      );
    }
    const added = addGroup(groups, group.start, group.end);
    if (!added) return groups;
    return added.map(other =>
      other.start === group.start && other.end === group.end
        ? { ...other, collapsed: group.collapsed }
        : other,
    );
  }, sortGroups(automatic));
}

/**
 * Collapses the groups nested deeper than `level` (1 shows only what is
 * outside every group, like Excel's outline level buttons) and expands the
 * others.
 */
export function collapseToLevel(
  groups: OutlineGroup[],
  level: number,
): OutlineGroup[] {
  const levels = groupLevels(groups);
  return groups.map((group, i) => ({
    ...group,
    collapsed: levels[i] >= level - 1,
  }));
}

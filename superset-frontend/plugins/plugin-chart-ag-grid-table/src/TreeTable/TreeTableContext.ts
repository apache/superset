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
  createContext,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { GenericDataType } from '@apache-superset/core/common';
import { GridApi } from 'ag-grid-community';
import { keyOf } from './childrenState';
import {
  ChildrenEntry,
  ExpandedMarker,
  TreeTableColumn,
  TreeLevel,
} from './types';
import { areaKey } from './useChildren';

export interface TreeTableContextValue {
  levels: TreeLevel[];
  verboseMap: Record<string, string>;
  data: Record<string, unknown>[];
  colnames: string[];
  coltypes: GenericDataType[];
  /** Children of each parent row, as `JSON.stringify(parent path)`. */
  entries: Map<string, ChildrenEntry>;
  expanded: Set<string>;
  /** Open rows at level 2 and below, as `JSON.stringify(path)`. */
  childExpanded: Set<string>;
  toggleChild: (path: string[]) => void;
  retry: (path: string[]) => void;
  buildColumns: (
    keys: string[],
    colnames: string[],
    coltypes: GenericDataType[],
  ) => TreeTableColumn[];
  reportHeight: (rowId: string, height: number) => void;
  /** Keep a grid's API by the path of the row that holds it (`[]` for the parent grid). */
  registerGrid: (parentPath: string[], api: GridApi) => () => void;
  /** Without it, every open area mounts its contents. */
  viewport?: AreaViewport;
  /** Last measured height of each open area, as `areaKey(path)`. */
  areaHeights?: Map<string, number>;
  /** Whether the remembered keyboard focus is on this path or below it. */
  keepsFocus?: (path: string[]) => boolean;
}

/** The grid context of a child table: its parent row's path and height reporter. */
export interface ChildGridContext {
  parentPath: string[];
  reportHeight: (rowId: string, height: number) => void;
}

export const TreeTableContext = createContext<TreeTableContextValue | null>(
  null,
);

export const markerRowId = (index: number) => `marker-${index}`;

const markers = new WeakSet<ExpandedMarker>();

/** Register synthetic rows by identity so dataset fields cannot mark real rows. */
export function createMarker(row: ExpandedMarker): ExpandedMarker {
  markers.add(row);
  return row;
}

export function isMarker(row: unknown): row is ExpandedMarker {
  return (
    typeof row === 'object' &&
    row !== null &&
    markers.has(row as ExpandedMarker)
  );
}

export const ESTIMATED_LINE_HEIGHT = 32;

/** Height of a detail block before it is measured. */
export function estimateDetailHeight(fields: number): number {
  return fields ? ESTIMATED_LINE_HEIGHT * (1 + Math.ceil(fields / 4) * 2) : 0;
}

/** Height of an open row's area before it is measured, from its entry. */
export function estimateExpandedHeight(
  detailFields: number,
  hasChildren: boolean,
  entry?: ChildrenEntry,
): number {
  let height = estimateDetailHeight(detailFields);
  if (hasChildren) {
    height +=
      entry?.status === 'loaded'
        ? ESTIMATED_LINE_HEIGHT * (entry.rows.length + 2)
        : ESTIMATED_LINE_HEIGHT * 3;
  }
  return Math.max(height, ESTIMATED_LINE_HEIGHT);
}

/** Height of an open area: its last measured height, else an estimate from its rows and their open areas. */
export function estimateAreaHeight(
  path: string[],
  {
    levels,
    entries,
    childExpanded,
    areaHeights,
  }: Pick<TreeTableContextValue, 'levels' | 'entries' | 'childExpanded'> & {
    areaHeights?: Map<string, number>;
  },
): number {
  const measured = areaHeights?.get(areaKey(path));
  if (measured !== undefined) return measured;
  const level = levels[path.length - 1];
  const childLevel = levels[path.length];
  const entry = entries.get(areaKey(path));
  let height = estimateExpandedHeight(
    level?.detail_fields.length ?? 0,
    Boolean(childLevel),
    entry,
  );
  if (childLevel && entry?.status === 'loaded')
    entry.rows.forEach(row => {
      const key = keyOf(row[childLevel.id_column]);
      if (key === undefined || !childExpanded.has(areaKey([...path, key])))
        return;
      height += estimateAreaHeight([...path, key], {
        levels,
        entries,
        childExpanded,
        areaHeights,
      });
    });
  return height;
}

/** Open areas mount their contents within this distance of the chart's viewport. */
export const AREA_OVERSCAN = 600;

export interface WatchedArea {
  root: HTMLElement;
  update: (near: boolean) => void;
}

export interface AreaViewport {
  /** Tell the area whether it is near the viewport after each scroll or resize. */
  watch: (area: WatchedArea) => () => void;
  isNear: (root: HTMLElement) => boolean;
  /** Check every watched area in the next animation frame. */
  schedule: () => void;
}

/**
 * Tracks which open areas are in or near `viewport`, the chart's scrolling
 * grid. Child grids have `autoHeight` and don't virtualize, so an area far
 * from it keeps only its height.
 */
export function useAreaViewport(
  viewport: RefObject<HTMLElement>,
): AreaViewport {
  const areas = useRef(new Set<WatchedArea>());
  const frame = useRef<number>();
  const isNear = useCallback(
    (root: HTMLElement) => {
      const box = viewport.current?.getBoundingClientRect();
      if (!box) return true;
      const rect = root.getBoundingClientRect();
      return (
        rect.bottom >= box.top - AREA_OVERSCAN &&
        rect.top <= box.bottom + AREA_OVERSCAN
      );
    },
    [viewport],
  );
  const schedule = useCallback(() => {
    if (frame.current !== undefined) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = undefined;
      areas.current.forEach(area => area.update(isNear(area.root)));
    });
  }, [isNear]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return undefined;
    element.addEventListener('scroll', schedule, {
      capture: true,
      passive: true,
    });
    const observer = new ResizeObserver(() => schedule());
    observer.observe(element);
    return () => {
      element.removeEventListener('scroll', schedule, { capture: true });
      observer.disconnect();
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
      frame.current = undefined;
    };
  }, [viewport, schedule]);
  const watch = useCallback((area: WatchedArea) => {
    areas.current.add(area);
    return () => {
      areas.current.delete(area);
    };
  }, []);
  return useMemo(
    () => ({ watch, isNear, schedule }),
    [watch, isNear, schedule],
  );
}

/**
 * Measured heights of full-width rows. Heights reported before the grid is
 * ready are kept and applied in `onGridReady`. A grid resets its row heights
 * at most once per animation frame.
 */
export function useRowHeights() {
  const api = useRef<GridApi>();
  const heights = useRef(new Map<string, number>());
  const frame = useRef<number>();
  const resetInFrame = useCallback(() => {
    if (frame.current !== undefined) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = undefined;
      if (api.current && !api.current.isDestroyed())
        api.current.resetRowHeights();
    });
  }, []);
  useEffect(
    () => () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    },
    [],
  );
  const reportHeight = useCallback(
    (rowId: string, height: number) => {
      if (heights.current.get(rowId) === height) return;
      heights.current.set(rowId, height);
      resetInFrame();
    },
    [resetInFrame],
  );
  const resetHeights = useCallback(
    (rowIds: string[]) => {
      const keep = new Set(rowIds);
      [...heights.current.keys()].forEach(rowId => {
        if (!keep.has(rowId)) heights.current.delete(rowId);
      });
      resetInFrame();
    },
    [resetInFrame],
  );
  const onReady = useCallback((gridApi: GridApi) => {
    api.current = gridApi;
    gridApi.resetRowHeights();
  }, []);
  return { api, heights, reportHeight, resetHeights, onReady };
}

/** Report the element's height whenever it changes size. */
export function useReportHeight(
  ref: RefObject<HTMLElement>,
  rowId: string,
  reportHeight: (rowId: string, height: number) => void,
) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) =>
      reportHeight(rowId, Math.ceil(entry.contentRect.height)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, rowId, reportHeight]);
}

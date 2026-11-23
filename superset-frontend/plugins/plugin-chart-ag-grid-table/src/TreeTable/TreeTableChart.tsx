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
  RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DataRecordValue } from '@superset-ui/core';
import { isEqual } from 'lodash-es';
import { ThemedAgGridReact } from '@superset-ui/core/components';
import { ClientSideRowModelApiModule, GridApi } from 'ag-grid-community';
import { TreeTableContainer } from './styles';
import { getCrossFilterDataMask } from '../utils/getCrossFilterDataMask';
import { updateTableOwnState } from '../utils/externalAPIs';
import {
  ExpandedMarker,
  TreeTableOwnState,
  TreeTableTransformedProps,
} from './types';
import { EXPAND_COLUMN } from './expandColumn';
import useParentColDefs, { ParentGridContext } from './useParentColDefs';
import { defaultSort } from './levelsToMirrors';
import useColumnSort from './useColumnSort';
import buildColumns from './columns';
import { keyOf } from './childrenState';
import ExpandedRow, { AreaStatusContext } from './ExpandedRow';
import {
  createMarker,
  estimateExpandedHeight,
  isMarker,
  markerRowId,
  TreeTableContext,
  TreeTableContextValue,
  useAreaViewport,
  useRowHeights,
} from './TreeTableContext';
import useChildren, {
  areaKey,
  ChildrenContext,
  ChildrenContextValue,
  parentFilters,
} from './useChildren';
import ExpandAllControl, { expandAllLevels } from './ExpandAllControl';
import { focusCell, FocusRouterContext, useFocusRouting } from './focusRouting';
import TreeTablePager from './TreeTablePager';

const GRID_MODULES = [ClientSideRowModelApiModule];

/** The rendered height of an element that can wrap, kept up to date. */
function useMeasuredHeight(ref: RefObject<HTMLElement>, shown: boolean) {
  const [measured, setMeasured] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      setMeasured(0);
      return undefined;
    }
    setMeasured(element.getBoundingClientRect().height);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() =>
      setMeasured(element.getBoundingClientRect().height),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, shown]);
  return measured;
}

/** Render a configured Tree grid and manage its expanded areas. */
function ConfiguredTreeTableChart({
  width,
  height,
  levels,
  data,
  colnames,
  coltypes,
  columns,
  rowcount,
  pageSize,
  currentPage,
  serverPageLength,
  ownState,
  setDataMask,
  emitCrossFilters,
  filters,
  sliceId,
  rawFormData,
  linkDateFormats,
  verboseMap,
  onChartStateChange,
}: TreeTableTransformedProps) {
  const clearedChartState = useRef(false);
  useEffect(() => {
    if (!clearedChartState.current && ownState.chartState) {
      clearedChartState.current = true;
      onChartStateChange?.({});
    }
  }, [ownState.chartState, onChartStateChange]);
  const api = useRef<GridApi<Record<string, unknown>>>();
  const chartRef = useRef<HTMLDivElement>(null);
  const router = useFocusRouting(chartRef);
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewport = useAreaViewport(viewportRef);
  const areaHeights = useRef(new Map<string, number>()).current;
  const speaking = useRef(new Set<string>()).current;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [childToggled, setChildToggled] = useState<Set<string>>(new Set());
  const [expandAllLevel, setExpandAllLevel] = useState(0);
  const [expandAllIntent, setExpandAllIntent] = useState<boolean>();
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const [level, childLevel] = levels;
  const grids = useRef(new Map<string, GridApi>());
  const registerGrid = useCallback((parentPath: string[], gridApi: GridApi) => {
    const key = areaKey(parentPath);
    grids.current.set(key, gridApi);
    return () => {
      if (grids.current.get(key) === gridApi) grids.current.delete(key);
    };
  }, []);
  const canOpen = Boolean(
    level && (levels.length > 1 || level.detail_fields.length),
  );
  const pageKeys = useMemo(
    () =>
      canOpen
        ? [
            ...new Set(
              data
                .map(row => keyOf(row[level.id_column]))
                .filter((key): key is string => key !== undefined),
            ),
          ]
        : [],
    [canOpen, data, level],
  );
  useEffect(() => {
    const onPage = new Set(pageKeys);
    const keep = (previous: Set<string>, parentOf: (key: string) => string) => {
      const next = new Set(
        [...previous].filter(key => onPage.has(parentOf(key))),
      );
      return next.size === previous.size ? previous : next;
    };
    setExpanded(previous => keep(previous, key => key));
    setChildToggled(previous =>
      keep(previous, key => (JSON.parse(key) as string[])[0]),
    );
  }, [pageKeys]);
  const children = useChildren({
    formData: rawFormData,
    linkDateFormats,
    pageKeys,
    expanded,
    data,
    childToggled,
    expandLevel: expandAllLevel,
  });
  const {
    entries,
    childExpanded,
    open,
    close,
    retry,
    reset,
    record,
    loadMore,
    sorts,
    setSort,
    areas,
    expandAll,
  } = children;
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const latestOwnState = useRef(ownState);
  latestOwnState.current = ownState;
  const update = useCallback(
    (changes: Partial<TreeTableOwnState>) => {
      areaHeights.clear();
      speaking.clear();
      setExpanded(new Set());
      setChildToggled(new Set());
      setExpandAllLevel(0);
      setExpandAllIntent(undefined);
      reset();
      updateTableOwnState(setDataMask, {
        ...latestOwnState.current,
        ...changes,
      });
    },
    [setDataMask, reset, areaHeights, speaking],
  );
  const previousLength = useRef(serverPageLength);
  const queryFilters = useMemo(() => parentFilters(rawFormData), [rawFormData]);
  const previousParentFilters = useRef(queryFilters);
  useEffect(() => {
    const queryChanged = !isEqual(previousParentFilters.current, queryFilters);
    previousParentFilters.current = queryFilters;
    if (previousLength.current !== serverPageLength) {
      previousLength.current = serverPageLength;
      update({ pageSize: serverPageLength, currentPage: 0 });
    } else if (queryChanged && currentPage !== 0) {
      update({ currentPage: 0 });
    } else if (rowcount > 0 && currentPage * pageSize >= rowcount) {
      const lastPage = Math.ceil(rowcount / pageSize) - 1;
      if (lastPage !== ownState.currentPage) update({ currentPage: lastPage });
    }
  }, [
    serverPageLength,
    queryFilters,
    rowcount,
    currentPage,
    pageSize,
    ownState.currentPage,
    update,
  ]);
  useEffect(() => {
    api.current?.sizeColumnsToFit();
  }, [width]);
  const toggle = useCallback(
    (id: string) => {
      setExpandAllIntent(undefined);
      if (!expandedRef.current.has(id)) {
        open([id]);
        record(areaKey([id]), 'expand');
        speaking.add(areaKey([id]));
      } else {
        close([id]);
        record(areaKey([id]), 'collapse');
        speaking.delete(areaKey([id]));
      }
      setExpanded(previous => {
        const next = new Set(previous);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [open, close, record, speaking],
  );
  const childExpandedRef = useRef(childExpanded);
  childExpandedRef.current = childExpanded;
  const toggleChild = useCallback(
    (path: string[]) => {
      setExpandAllIntent(undefined);
      const key = areaKey(path);
      if (childExpandedRef.current.has(key)) {
        close(path);
        record(key, 'collapse');
        speaking.delete(key);
      } else {
        open(path);
        record(key, 'expand');
        speaking.add(key);
      }
      setChildToggled(previous => {
        const next = new Set(previous);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    [open, close, record, speaking],
  );
  useEffect(() => {
    setChildToggled(previous => {
      const next = new Set(
        [...previous].filter(key => {
          const path = JSON.parse(key) as string[];
          const parent = entries.get(areaKey(path.slice(0, -1)));
          const rowLevel = levels[path.length - 1];
          if (
            !rowLevel ||
            (parent?.status !== 'loaded' && parent?.status !== 'empty')
          )
            return true;
          return parent.rows.some(
            row => keyOf(row[rowLevel.id_column]) === path[path.length - 1],
          );
        }),
      );
      return next.size === previous.size ? previous : next;
    });
  }, [entries, levels]);
  const pickExpandAll = useCallback(
    (pick: number) => {
      const openable = expandAllLevels(levels);
      setExpandAllIntent(
        pick === 0
          ? false
          : pick === openable[openable.length - 1]
            ? true
            : undefined,
      );
      const keys = pick > 0 ? pageKeys : [];
      const childKeys = new Set<string>();
      let parents = keys.map(key => [key]);
      for (let index = 1; index < pick && levels[index]; index += 1) {
        const { id_column: idColumn } = levels[index];
        parents = parents.flatMap(
          parent =>
            entries
              .get(areaKey(parent))
              ?.rows.map(row => keyOf(row[idColumn]))
              .filter((key): key is string => key !== undefined)
              .map(key => [...parent, key]) ?? [],
        );
        parents.forEach(path => childKeys.add(areaKey(path)));
      }
      if (!pick) areaHeights.clear();
      speaking.clear();
      expandAll(pick, keys, [...childKeys]);
      setExpandAllLevel(pick);
      setChildToggled(new Set());
      setExpanded(new Set(keys));
    },
    [pageKeys, levels, entries, expandAll, areaHeights, speaking],
  );
  const collapseAll = useCallback(() => pickExpandAll(0), [pickExpandAll]);
  const allOpen = useMemo(() => {
    const openable = new Set(expandAllLevels(levels));
    const isOpen = (path: string[]): boolean => {
      if (!openable.has(path.length)) return true;
      if (
        path.length === 1
          ? !expanded.has(path[0])
          : !childExpanded.has(areaKey(path))
      )
        return false;
      const next = levels[path.length];
      if (!next || !openable.has(path.length + 1)) return true;
      const entry = entries.get(areaKey(path));
      if (entry?.status !== 'loaded' && entry?.status !== 'empty') return false;
      return entry.rows.every(row => {
        const key = keyOf(row[next.id_column]);
        return key === undefined || isOpen([...path, key]);
      });
    };
    return pageKeys.length > 0 && pageKeys.every(key => isOpen([key]));
  }, [levels, expanded, childExpanded, entries, pageKeys]);
  const focusNearestToggle = useCallback(
    (path: string[]) => {
      for (let { length } = path; length > 0; length -= 1) {
        const rowPath = path.slice(0, length);
        const rowLevel = levels[length - 1];
        const gridApi = grids.current.get(areaKey(rowPath.slice(0, -1)));
        if (
          rowLevel &&
          gridApi &&
          !gridApi.isDestroyed() &&
          focusCell(
            gridApi,
            row =>
              !isMarker(row) &&
              keyOf((row as Record<string, unknown>)?.[rowLevel.id_column]) ===
                rowPath[length - 1],
            EXPAND_COLUMN,
          )
        )
          return true;
      }
      return false;
    },
    [levels],
  );
  const focused = useRef<{
    path: string[];
    element: HTMLElement;
    deferRestore?: () => boolean;
  }>();
  const holdFocus = useCallback<ChildrenContextValue['holdFocus']>(
    (path, button, deferRestore) => {
      focused.current = { path, element: button, deferRestore };
    },
    [],
  );
  const keepsFocus = useCallback((path: string[]) => {
    const memory = focused.current;
    const active = document.activeElement;
    if (
      !memory ||
      (active &&
        active !== document.body &&
        !chartRef.current?.contains(active))
    )
      return false;
    return (
      path.length <= memory.path.length &&
      path.every((key, index) => memory.path[index] === key)
    );
  }, []);
  const reconcileFocus = useRef<() => void>();
  useEffect(() => {
    const root = chartRef.current;
    if (!root) return undefined;
    const pathOf = (target: HTMLElement): string[] | undefined => {
      const row = target.closest<HTMLElement>('[row-index]');
      const gridApi = row?.closest<HTMLElement & { _agGridApi?: GridApi }>(
        '[data-themed-ag-grid]',
      )?._agGridApi;
      if (!row || !gridApi) return undefined;
      const rowId = row.getAttribute('row-id');
      const rowData = (
        rowId !== null
          ? gridApi.getRowNode(rowId)
          : gridApi.getDisplayedRowAtIndex(
              Number(row.getAttribute('row-index')),
            )
      )?.data;
      if (isMarker(rowData)) return rowData.path;
      const parent = [...grids.current].find(([, item]) => item === gridApi);
      if (!parent) return undefined;
      const parentPath = JSON.parse(parent[0]) as string[];
      const key = keyOf(
        (rowData as Record<string, unknown> | undefined)?.[
          levels[parentPath.length]?.id_column
        ],
      );
      if (key !== undefined) return [...parentPath, key];
      return parentPath.length ? parentPath : undefined;
    };
    const rowShown = (path: string[]) => {
      const gridApi = grids.current.get(areaKey(path.slice(0, -1)));
      const rowLevel = levels[path.length - 1];
      let shown = false;
      gridApi?.forEachNode(node => {
        if (
          !isMarker(node.data) &&
          keyOf(node.data?.[rowLevel?.id_column]) === path[path.length - 1]
        )
          shown = true;
      });
      return shown;
    };
    let restoring = false;
    let lastInput = 0;
    const restore = (path: string[]) => {
      focused.current = undefined;
      restoring = true;
      focusNearestToggle(path);
      restoring = false;
    };
    const onInput = () => {
      lastInput = performance.now();
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      const path = pathOf(target);
      const previous = focused.current;
      // AG Grid moves focus to a neighbour row when the focused row leaves its
      // data. It can move directly from that row before the DOM is removed,
      // even if a key or pointer press just focused it.
      if (
        previous &&
        path &&
        !restoring &&
        (event.relatedTarget === previous.element ||
          performance.now() - lastInput > 100) &&
        JSON.stringify(path) !== JSON.stringify(previous.path) &&
        !rowShown(previous.path)
      ) {
        restore(previous.path);
        return;
      }
      focused.current = path ? { path, element: target } : undefined;
    };
    // AG Grid keeps a focused cell when new data puts another row at its row
    // ID; no focus event fires, so compare the path under focus with the saved one.
    let check: ReturnType<typeof setTimeout> | undefined;
    const reconcile = () => {
      check = undefined;
      const memory = focused.current;
      if (
        !memory ||
        restoring ||
        !memory.element.isConnected ||
        document.activeElement !== memory.element
      )
        return;
      const path = pathOf(memory.element);
      if (path && JSON.stringify(path) !== JSON.stringify(memory.path))
        restore(memory.path);
    };
    const scheduleReconcile = () => {
      if (check === undefined) check = setTimeout(reconcile);
    };
    reconcileFocus.current = scheduleReconcile;
    // A focused row or button that goes away (re-sort, refresh, Collapse all,
    // a finished Retry) hands focus to the nearest +/- on its path.
    const observer = new MutationObserver(() => {
      const memory = focused.current;
      if (!memory) return;
      if (memory.element.isConnected) {
        scheduleReconcile();
        return;
      }
      setTimeout(() => {
        if (focused.current !== memory || memory.deferRestore?.()) return;
        const active = document.activeElement;
        if (active && active !== document.body && active.isConnected) return;
        restore(memory.path);
      });
    });
    document.addEventListener('keydown', onInput, true);
    document.addEventListener('pointerdown', onInput, true);
    root.addEventListener('focusin', onFocusIn);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => {
      if (check !== undefined) clearTimeout(check);
      reconcileFocus.current = undefined;
      document.removeEventListener('keydown', onInput, true);
      document.removeEventListener('pointerdown', onInput, true);
      root.removeEventListener('focusin', onFocusIn);
      observer.disconnect();
    };
  }, [levels, focusNearestToggle]);
  useEffect(() => reconcileFocus.current?.(), [data, entries]);
  const childrenContext = useMemo<ChildrenContextValue>(
    () => ({ loadMore, sorts, setSort, areas, holdFocus }),
    [loadMore, sorts, setSort, areas, holdFocus],
  );
  const heights = useRowHeights();
  const { reportHeight, resetHeights } = heights;
  const rowIndex = useRef(new Map<unknown, number>());
  rowIndex.current = new Map(data.map((row, index) => [row, index]));
  const rowData = useMemo(
    () =>
      data.flatMap((row, index) => {
        const key = canOpen ? keyOf(row[level.id_column]) : undefined;
        if (key === undefined || !expanded.has(key)) return [row];
        const marker: ExpandedMarker = createMarker({
          __treeTableExpanded: true,
          parentKey: key,
          parentIndex: index,
          path: [key],
        });
        return [row, marker];
      }),
    [data, canOpen, level, expanded],
  );
  useEffect(() => {
    // AG Grid draws new row data in its own effect; resetting heights in the
    // same flush re-enters its row renderer (AG Grid error #252).
    const timer = setTimeout(() =>
      resetHeights(
        rowData.filter(isMarker).map(marker => markerRowId(marker.parentIndex)),
      ),
    );
    return () => clearTimeout(timer);
  }, [rowData, entries, resetHeights]);
  const buildLevelColumns = useCallback<TreeTableContextValue['buildColumns']>(
    (keys, names, types) => buildColumns(keys, names, types, verboseMap),
    [verboseMap],
  );
  const treeTableContext = useMemo<TreeTableContextValue>(
    () => ({
      levels,
      verboseMap,
      data,
      colnames,
      coltypes,
      entries,
      expanded,
      childExpanded,
      toggleChild,
      retry,
      buildColumns: buildLevelColumns,
      reportHeight,
      registerGrid,
      viewport,
      areaHeights,
      keepsFocus,
    }),
    [
      levels,
      verboseMap,
      data,
      colnames,
      coltypes,
      entries,
      expanded,
      childExpanded,
      toggleChild,
      retry,
      buildLevelColumns,
      reportHeight,
      registerGrid,
      viewport,
      areaHeights,
      keepsFocus,
    ],
  );
  const isActiveFilterValue = useCallback(
    (key: string, value: DataRecordValue) =>
      filters?.[key]?.some(
        item =>
          item === value ||
          (item instanceof Date &&
            value instanceof Date &&
            item.getTime() === value.getTime()),
      ) ?? false,
    [filters],
  );
  const fallbackSort = useMemo(() => defaultSort(levels[0]), [levels]);
  const colDefs = useParentColDefs(
    columns,
    ownState,
    emitCrossFilters,
    isActiveFilterValue,
    fallbackSort,
    levels[0].sort,
  );
  const parentSort = ownState.sortBy?.[0];
  const onSortChanged = useColumnSort(
    parentSort ? [parentSort.id, !parentSort.desc] : undefined,
    fallbackSort,
    levels[0].sort,
    next =>
      update({
        currentPage: 0,
        sortBy: next ? [{ id: next[0], key: next[0], desc: !next[1] }] : [],
      }),
  );
  const context = useMemo<ParentGridContext>(
    () => ({ levels, expanded, toggle }),
    [levels, expanded, toggle],
  );
  useEffect(() => {
    api.current?.setGridOption('context', context);
    api.current?.refreshCells({ columns: [EXPAND_COLUMN], force: true });
  }, [context]);
  const showBar = expandAllLevels(levels).length > 0;
  const barRef = useRef<HTMLDivElement>(null);
  const pagerRef = useRef<HTMLDivElement>(null);
  const barHeight = useMeasuredHeight(barRef, showBar);
  const pagerHeight = useMeasuredHeight(pagerRef, true);
  const gridHeight = Math.max(height - barHeight - pagerHeight, 0);
  return (
    <TreeTableContainer
      height={height}
      ref={chartRef}
      onContextMenu={event => event.stopPropagation()}
    >
      {showBar && (
        <div ref={barRef}>
          <ExpandAllControl
            levels={levels}
            allOpen={expanded.size > 0 ? (expandAllIntent ?? allOpen) : false}
            onChange={pickExpandAll}
            onCollapseAll={collapseAll}
          />
        </div>
      )}
      <div ref={viewportRef} style={{ width, height: gridHeight }}>
        <FocusRouterContext.Provider value={router}>
          <ChildrenContext.Provider value={childrenContext}>
            <TreeTableContext.Provider value={treeTableContext}>
              <AreaStatusContext.Provider value={speaking}>
                <ThemedAgGridReact
                  modules={GRID_MODULES}
                  context={context}
                  rowData={rowData}
                  columnDefs={colDefs}
                  getRowId={({ data: row }) =>
                    isMarker(row)
                      ? markerRowId(row.parentIndex)
                      : `row-${rowIndex.current.get(row)}`
                  }
                  isFullWidthRow={({ rowNode }) => isMarker(rowNode.data)}
                  fullWidthCellRenderer={ExpandedRow}
                  getRowHeight={({ data: row }) =>
                    isMarker(row)
                      ? (heights.heights.current.get(
                          markerRowId(row.parentIndex),
                        ) ??
                        estimateExpandedHeight(
                          level.detail_fields.length,
                          Boolean(childLevel),
                          entriesRef.current.get(areaKey([row.parentKey])),
                        ))
                      : undefined
                  }
                  rowModelType="clientSide"
                  pagination={false}
                  suppressMultiSort
                  suppressMovableColumns
                  ensureDomOrder
                  embedFullWidthRows
                  onGridReady={event => {
                    api.current = event.api;
                    registerGrid([], event.api);
                    heights.onReady(event.api);
                    event.api.sizeColumnsToFit();
                    event.api.refreshCells({
                      columns: [EXPAND_COLUMN],
                      force: true,
                    });
                  }}
                  onSortChanged={onSortChanged}
                  onCellClicked={event => {
                    if (isMarker(event.data)) return;
                    const key = event.column.getColId();
                    if (!emitCrossFilters || key === EXPAND_COLUMN) return;
                    setDataMask(
                      getCrossFilterDataMask({
                        key,
                        value: event.value as DataRecordValue,
                        filters,
                        isActiveFilterValue,
                        timestampFormatter: String,
                      }).dataMask,
                    );
                  }}
                />
              </AreaStatusContext.Provider>
            </TreeTableContext.Provider>
          </ChildrenContext.Provider>
        </FocusRouterContext.Provider>
      </div>
      <TreeTablePager
        ref={pagerRef}
        currentPage={currentPage}
        pageSize={pageSize}
        total={rowcount}
        sliceId={sliceId}
        onPageChange={page => update({ currentPage: page })}
        onPageSizeChange={size => update({ pageSize: size, currentPage: 0 })}
      />
    </TreeTableContainer>
  );
}

/** Render a Tree grid only when a parent level is configured. */
export default function TreeTableChart(props: TreeTableTransformedProps) {
  return props.levels?.length ? <ConfiguredTreeTableChart {...props} /> : null;
}

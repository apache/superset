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
import { useContext, useEffect, useMemo, useRef } from 'react';
import { ThemedAgGridReact } from '@superset-ui/core/components';
import {
  ClientSideRowModelApiModule,
  GridApi,
  HeaderPosition,
  TabToNextHeaderParams,
} from 'ag-grid-community';
import ExpandedRow from './ExpandedRow';
import { keyOf } from './childrenState';
import {
  ChildGridContext,
  createMarker,
  estimateExpandedHeight,
  isMarker,
  markerRowId,
  TreeTableContext,
  useRowHeights,
} from './TreeTableContext';
import { ChildrenEntry, ExpandedMarker } from './types';
import useChildColDefs from './useChildColDefs';
import { defaultSort, sortableColumns } from './levelsToMirrors';
import useColumnSort from './useColumnSort';
import { areaKey, ChildrenContext } from './useChildren';

const GRID_MODULES = [ClientSideRowModelApiModule];

/**
 * Tab between header cells of one header row, then into the first body cell.
 * AG Grid resets its remembered header row only on a mouse press, so after a
 * keyboard exit from the header its own pick skips the header row.
 */
function tabToNextHeader({
  api,
  backwards,
  previousHeaderPosition,
  nextHeaderPosition,
}: TabToNextHeaderParams): HeaderPosition | boolean {
  if (!previousHeaderPosition) return nextHeaderPosition ?? false;
  const columns = api.getAllDisplayedColumns();
  const index = columns.findIndex(
    column => column === previousHeaderPosition.column,
  );
  const next = columns[index + (backwards ? -1 : 1)];
  if (index >= 0 && next)
    return {
      headerRowIndex: previousHeaderPosition.headerRowIndex,
      column: next,
    };
  if (backwards || !columns.length) return false;
  return { headerRowIndex: -1, column: columns[0] };
}

export interface ChildTableProps {
  /** The index of the level this table shows (1 or more). */
  levelIndex: number;
  entry: ChildrenEntry;
  /** The path of the row that holds this table. */
  parentPath: string[];
}

/** A child table at any level, in its level's sort; its open area shows the count line and Load more. */
export default function ChildTable({
  levelIndex,
  entry,
  parentPath: givenPath,
}: ChildTableProps) {
  const treeTable = useContext(TreeTableContext);
  const childrenContext = useContext(ChildrenContext);
  const { heights, reportHeight, resetHeights, onReady } = useRowHeights();
  const { buildColumns, childExpanded, entries, levels, registerGrid } =
    treeTable!;
  const parentKey = areaKey(givenPath);
  const parentPath = useMemo(
    () => JSON.parse(parentKey) as string[],
    [parentKey],
  );
  const level = levels[levelIndex];
  const hasChildren = Boolean(levels[levelIndex + 1]);
  const columns = useMemo(
    () =>
      buildColumns(
        level.columns?.length ? level.columns : [level.id_column],
        entry.colnames,
        entry.coltypes,
      ),
    [
      buildColumns,
      level.columns,
      level.id_column,
      entry.colnames,
      entry.coltypes,
    ],
  );
  const canOpen = hasChildren || level.detail_fields.length > 0;
  const sortable = useMemo(() => sortableColumns(level), [level]);
  const fallback = useMemo(() => defaultSort(level), [level]);
  const sort = childrenContext?.sorts.get(levelIndex);
  const onSortChanged = useColumnSort(sort, fallback, level.sort, next =>
    childrenContext?.setSort(levelIndex, next, parentPath),
  );
  const colDefs = useChildColDefs(
    columns,
    canOpen,
    parentPath,
    levelIndex,
    sort ?? fallback,
    sortable,
    level.sort,
  );
  const rowIndex = useRef(new Map<unknown, number>());
  rowIndex.current = new Map(entry.rows.map((row, index) => [row, index]));
  const rowData = useMemo(
    () =>
      entry.rows.flatMap<Record<string, unknown> | ExpandedMarker>(
        (row, index) => {
          const key = keyOf(row[level.id_column]);
          const path = key === undefined ? undefined : [...parentPath, key];
          return canOpen && path && childExpanded.has(areaKey(path))
            ? [
                row,
                createMarker({
                  __treeTableExpanded: true,
                  parentKey: key!,
                  parentIndex: index,
                  path,
                }),
              ]
            : [row];
        },
      ),
    [entry.rows, level.id_column, canOpen, childExpanded, parentPath],
  );
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  useEffect(() => {
    resetHeights(
      rowData.filter(isMarker).map(marker => markerRowId(marker.parentIndex)),
    );
  }, [rowData, resetHeights]);
  const unregister = useRef<() => void>();
  useEffect(() => () => unregister.current?.(), []);
  const gridContext = useMemo<ChildGridContext>(
    () => ({ parentPath, reportHeight }),
    [parentPath, reportHeight],
  );
  return (
    <ThemedAgGridReact
      modules={GRID_MODULES}
      domLayout="autoHeight"
      rowModelType="clientSide"
      pagination={false}
      suppressMovableColumns
      suppressMultiSort
      ensureDomOrder
      embedFullWidthRows
      tabToNextHeader={tabToNextHeader}
      context={gridContext}
      rowData={rowData}
      columnDefs={colDefs}
      getRowId={({ data }) =>
        isMarker(data)
          ? markerRowId(data.parentIndex)
          : `row-${rowIndex.current.get(data)}`
      }
      isFullWidthRow={({ rowNode }) => isMarker(rowNode.data)}
      fullWidthCellRenderer={ExpandedRow}
      getRowHeight={({ data }) =>
        isMarker(data)
          ? (heights.current.get(markerRowId(data.parentIndex)) ??
            estimateExpandedHeight(
              level.detail_fields.length,
              hasChildren,
              entriesRef.current.get(areaKey(data.path)),
            ))
          : undefined
      }
      onGridReady={({ api }) => {
        unregister.current?.();
        unregister.current = registerGrid(parentPath, api as GridApi);
        onReady(api);
        api.sizeColumnsToFit();
      }}
      onGridSizeChanged={({ api }) => api.sizeColumnsToFit()}
      onSortChanged={onSortChanged}
    />
  );
}

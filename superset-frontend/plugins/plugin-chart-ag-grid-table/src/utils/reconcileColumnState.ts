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
  type ColDef,
  type ColumnState,
} from '@superset-ui/core/components/ThemedAgGridReact';

type ColumnGroupDef = ColDef & {
  children?: ColumnDefLike[];
};

type ColumnDefLike = ColDef | ColumnGroupDef;

function hasChildren(colDef: ColumnDefLike): colDef is ColumnGroupDef {
  return 'children' in colDef;
}

export interface ReconciledColumnState {
  applyOrder: boolean;
  columnState: ColumnState[];
}

export function getLeafColumnIds(colDefs: ColumnDefLike[]): string[] {
  return colDefs.flatMap(colDef => {
    if (
      hasChildren(colDef) &&
      Array.isArray(colDef.children) &&
      colDef.children.length > 0
    ) {
      return getLeafColumnIds(colDef.children);
    }

    return typeof colDef.field === 'string' ? [colDef.field] : [];
  });
}

export default function reconcileColumnState(
  savedColumnState: ColumnState[] | undefined,
  colDefs: ColumnDefLike[],
): ReconciledColumnState | null {
  if (!Array.isArray(savedColumnState) || savedColumnState.length === 0) {
    return null;
  }

  const currentColumnIds = getLeafColumnIds(colDefs);
  const currentColumnIdSet = new Set(currentColumnIds);
  const filteredColumnState = savedColumnState.filter(
    column =>
      typeof column.colId === 'string' && currentColumnIdSet.has(column.colId),
  );

  if (filteredColumnState.length === 0) {
    return null;
  }

  const savedColumnIds = filteredColumnState.map(column => column.colId);
  const hasSameColumnSet =
    currentColumnIds.length === savedColumnIds.length &&
    currentColumnIds.every(columnId => savedColumnIds.includes(columnId));

  return {
    columnState: filteredColumnState,
    applyOrder: hasSameColumnSet,
  };
}

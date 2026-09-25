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
import type { ColumnState } from '@superset-ui/core/components/ThemedAgGridReact';

type SortModelEntry = {
  colId: string;
  sort: 'asc' | 'desc';
  sortIndex: number;
};

/**
 * Stable signature of the persisted parts of AG Grid column state (order,
 * value aggregation, sorts, filters), used to detect changes worth saving.
 * `aggFunc` is normalized so the "None" option (`null`/`undefined`) produces
 * a distinct signature instead of reverting to the default on reload.
 */
export default function getColumnStateSignature(
  columnState: ColumnState[],
  sortModel: SortModelEntry[],
  filterModel: Record<string, unknown>,
): string {
  return JSON.stringify({
    columnOrder: columnState.map(col => col.colId),
    aggregations: columnState.map(col => ({
      colId: col.colId,
      // "None" (null/undefined) maps to an explicit sentinel; functions map
      // to a fixed marker so the signature never depends on JSON.stringify
      // dropping them (defensive: persisted aggFuncs are always strings).
      aggFunc:
        typeof col.aggFunc === 'function' ? 'custom' : (col.aggFunc ?? null),
    })),
    sorts: sortModel,
    filters: filterModel,
  });
}

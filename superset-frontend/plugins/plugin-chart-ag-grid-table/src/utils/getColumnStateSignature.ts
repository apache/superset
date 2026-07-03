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
 * Builds a stable signature of the parts of AG Grid column state that must be
 * persisted (and therefore must trigger an `onColumnStateChange` when they
 * change): column order, per-column value aggregation, sorts and filters.
 *
 * The value aggregation (`aggFunc`) is normalized so that "no aggregation"
 * (the AG Grid "None" option, represented as `null`/`undefined`) produces a
 * distinct, stable signature. Without this, switching a column's Value
 * Aggregation to "None" did not change the signature, so the change was never
 * captured and the column reverted to its default aggregation on reload.
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
      // Normalize falsy "None" (null/undefined) to an explicit sentinel so it
      // is preserved and distinguishable from a real aggregation function.
      // Function-valued aggregators get a fixed marker so the signature does
      // not depend on JSON.stringify silently dropping function values; AG
      // Grid requires registered string names for aggFuncs in serialized
      // column state, so this plugin only ever persists strings and the
      // marker is purely defensive.
      aggFunc:
        typeof col.aggFunc === 'function' ? 'custom' : (col.aggFunc ?? null),
    })),
    sorts: sortModel,
    filters: filterModel,
  });
}

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

// @types/react-table intentionally ships TableOptions/TableInstance/
// TableState/ColumnInstance as empty base interfaces, to be extended per
// project via declaration merging with exactly the plugin hooks in use
// (documented directly in @types/react-table's own index.d.ts, linking
// https://gist.github.com/ggascoigne/646e14c9d54258e40588a13aabf0102d as the
// canonical pattern). This TS project (superset-ui-core) is a separate
// compilation unit from the superset-frontend app, so it needs its own copy
// of this augmentation, scoped to what it actually uses: TableView's
// useTable(useFilters, useSortBy) call, and TableCollection reading
// isSorted/isSortedDesc off the HeaderGroups a caller's useTable() produced
// (e.g. ListView's, in the app).
import type {
  UseFiltersInstanceProps,
  UseFiltersOptions,
  UseFiltersState,
  UsePaginationOptions,
  UseSortByColumnProps,
  UseSortByInstanceProps,
  UseSortByOptions,
  UseSortByState,
} from 'react-table';

declare module 'react-table' {
  export interface TableOptions<D extends object>
    extends
      UseFiltersOptions<D>,
      // TableView passes `manualPagination` even though it never installs
      // the usePagination plugin hook itself (the option is a harmless
      // no-op without it) — included here so the options object type-checks.
      UsePaginationOptions<D>,
      UseSortByOptions<D> {}

  export interface TableInstance<D extends object>
    extends UseFiltersInstanceProps<D>, UseSortByInstanceProps<D> {}

  export interface TableState<D extends object>
    extends UseFiltersState<D>, UseSortByState<D> {}

  // Column-instance props only exist for plugins this project actually
  // reads; add more here only as new column-level accessors are needed.
  export interface ColumnInstance<
    D extends object,
  > extends UseSortByColumnProps<D> {}
}

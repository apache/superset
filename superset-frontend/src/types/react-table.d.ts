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

// @types/react-table intentionally ships TableOptions/TableInstance/TableState
// as empty base interfaces, to be extended per-project via declaration
// merging with exactly the plugin hooks in use (documented directly in
// @types/react-table's own index.d.ts, linking
// https://gist.github.com/ggascoigne/646e14c9d54258e40588a13aabf0102d as the
// canonical pattern). Without this, every useTable() call combining plugin
// hooks needs an `as any` to pass options/read instance properties the base
// types don't know about. This covers the plugin combination used by
// ListView (useFilters, useSortBy, usePagination, useRowState, useRowSelect).
import type {
  UseFiltersInstanceProps,
  UseFiltersOptions,
  UseFiltersState,
  UsePaginationInstanceProps,
  UsePaginationOptions,
  UsePaginationState,
  UseRowSelectInstanceProps,
  UseRowSelectOptions,
  UseRowSelectState,
  UseRowStateInstanceProps,
  UseRowStateOptions,
  UseRowStateState,
  UseSortByInstanceProps,
  UseSortByOptions,
  UseSortByState,
} from 'react-table';

declare module 'react-table' {
  export interface TableOptions<D extends object>
    extends
      UseFiltersOptions<D>,
      UseSortByOptions<D>,
      UsePaginationOptions<D>,
      UseRowStateOptions<D>,
      UseRowSelectOptions<D> {}

  export interface TableInstance<D extends object>
    extends
      UseFiltersInstanceProps<D>,
      UseSortByInstanceProps<D>,
      UsePaginationInstanceProps<D>,
      UseRowStateInstanceProps<D>,
      UseRowSelectInstanceProps<D> {}

  export interface TableState<D extends object>
    extends
      UseFiltersState<D>,
      UseSortByState<D>,
      UsePaginationState<D>,
      UseRowStateState<D>,
      UseRowSelectState<D> {}
}

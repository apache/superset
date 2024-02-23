/*
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
 * Merge typing interfaces for UseTable hooks.
 *
 * Ref: https://gist.github.com/ggascoigne/646e14c9d54258e40588a13aabf0102d
 */
import {
  UseGlobalFiltersState,
  UseGlobalFiltersOptions,
  UseGlobalFiltersInstanceProps,
  UsePaginationInstanceProps,
  UsePaginationOptions,
  UsePaginationState,
  UseSortByColumnOptions,
  UseSortByColumnProps,
  UseSortByInstanceProps,
  UseSortByOptions,
  UseSortByState,
  UseTableHooks,
  UseSortByHooks,
  UseColumnOrderState,
  UseColumnOrderInstanceProps,
  Renderer,
  HeaderProps,
  TableFooterProps,
} from 'react-table';

import {
  UseStickyState,
  UseStickyTableOptions,
  UseStickyInstanceProps,
} from '../hooks/useSticky';

declare module 'react-table' {
  export interface TableOptions<D extends object>
    extends UseExpandedOptions<D>,
      UseGlobalFiltersOptions<D>,
      UsePaginationOptions<D>,
      UseRowSelectOptions<D>,
      UseSortByOptions<D>,
      UseStickyTableOptions {}

  export interface TableInstance<D extends object>
    extends UseColumnOrderInstanceProps<D>,
      UseExpandedInstanceProps<D>,
      UseGlobalFiltersInstanceProps<D>,
      UsePaginationInstanceProps<D>,
      UseRowSelectInstanceProps<D>,
      UseRowStateInstanceProps<D>,
      UseSortByInstanceProps<D>,
      UseColumnOrderInstanceProps<D>,
      UseStickyInstanceProps {}

  export interface TableState<D extends object>
    extends UseColumnOrderState<D>,
      UseExpandedState<D>,
      UseGlobalFiltersState<D>,
      UsePaginationState<D>,
      UseRowSelectState<D>,
      UseSortByState<D>,
      UseColumnOrderState<D>,
      UseStickyState {}

  // Typing from @types/react-table is incomplete
  interface TableSortByToggleProps {
    style?: React.CSSProperties;
    title?: string;
    onClick?: React.MouseEventHandler;
  }

  interface TableRearrangeColumnsProps {
    onDragStart: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  }

  export interface ColumnInterface<D extends object>
    extends UseGlobalFiltersColumnOptions<D>,
      UseSortByColumnOptions<D> {
    // must define as a new property because it's not possible to override
    // the existing `Header` renderer option
    Header?: Renderer<
      TableSortByToggleProps & HeaderProps<D> & TableRearrangeColumnsProps
    >;
    Footer?: Renderer<TableFooterProps<D>>;
  }

  export interface ColumnInstance<D extends object>
    extends UseGlobalFiltersColumnOptions<D>,
      UseSortByColumnProps<D> {
    getSortByToggleProps: (
      props?: Partial<TableSortByToggleProps>,
    ) => TableSortByToggleProps;
  }

  export interface Hooks<D extends object>
    extends UseTableHooks<D>,
      UseSortByHooks<D> {}
}

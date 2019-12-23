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

// Type definitions for react-table 7
// Project: https://github.com/tannerlinsley/react-table#readme
// Definitions by: Adrien Denat <https://github.com/grsmto>
//                 Artem Berdyshev <https://github.com/berdyshev>
//                 Christian Murphy <https://github.com/ChristianMurphy>
//                 Tai Dupreee <https://github.com/nytai>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 3.0
declare module 'react-table' {
  import { Dispatch, ReactNode, SetStateAction } from 'react';

  export interface Cell<D> {
    render: (type: string) => any;
    getCellProps: () => { key: string; [k: string]: any };
    column: Column<D>;
    row: Row<D>;
    state: any;
    value: any;
  }

  export interface Row<D> {
    index: number;
    cells: Array<Cell<D>>;
    getRowProps: () => { key: string; [k: string]: any };
    original: any;
    state?: any;
    setState?: (state: any) => any;
  }

  export interface HeaderColumn<D, A extends keyof D = never> {
    /**
     * This string/function is used to build the data model for your column.
     */
    accessor: A | ((originalRow: D) => string);
    Header?: string | ((props: TableInstance<D>) => ReactNode);
    Filter?: string | ((props: TableInstance<D>) => ReactNode);
    Cell?: string | ((cell: Cell<D>) => ReactNode);

    /**
     * This is the unique ID for the column. It is used by reference in things like sorting, grouping, filtering etc.
     */
    id?: string | number;
    minWidth?: string | number;
    maxWidth?: string | number;
    width?: string | number;
    canSortBy?: boolean;
    sortByFn?: (a: any, b: any, desc: boolean) => 0 | 1 | -1;
    defaultSortDesc?: boolean;
    [key: string]: any;
  }

  export interface Column<D, A extends keyof D = never>
    extends HeaderColumn<D, A> {
    id: string | number;
  }

  export type Page<D> = Array<Row<D>>;

  export interface EnhancedColumn<D, A extends keyof D = never>
    extends Column<D, A> {
    render: (type: string) => any;
    getHeaderProps: (userProps?: any) => any;
    getSortByToggleProps: (userProps?: any) => any;
    sorted: boolean;
    sortedDesc: boolean;
    sortedIndex: number;
  }

  export interface HeaderGroup<D, A extends keyof D = never> {
    headers: Array<EnhancedColumn<D, A>>;
    getRowProps: (userProps?: any) => any;
    getHeaderGroupProps: (userProps?: any) => any;
  }

  export interface Hooks<D> {
    beforeRender: [];
    columns: [];
    headerGroups: [];
    headers: [];
    rows: Array<Row<D>>;
    row: [];
    renderableRows: [];
    getTableProps: [];
    getRowProps: [];
    getHeaderRowProps: [];
    getHeaderProps: [];
    getCellProps: [];
  }

  export interface TableInstance<D>
    extends TableOptions<D>,
      UseRowsValues<D>,
      UseFiltersValues,
      UsePaginationValues<D>,
      UseColumnsValues<D>,
      UseRowStateValues<D> {
    hooks: Hooks<D>;
    rows: Array<Row<D>>;
    columns: Array<EnhancedColumn<D>>;
    getTableProps: (userProps?: any) => any;
    getTableBodyProps: (userProps?: any) => any;
    getRowProps: (userProps?: any) => any;
    prepareRow: (row: Row<D>) => any;
    getSelectRowToggleProps: (userProps?: any) => any;
    toggleSelectAll: (forcedState: boolean) => any;
    state: { [key: string]: any };
  }

  export interface TableOptions<D> {
    data: D[];
    columns: Array<HeaderColumn<D>>;
    state?: { [key: string]: any };
    debug?: boolean;
    sortByFn?: (a: any, b: any, desc: boolean) => 0 | 1 | -1;
    manualSorting?: boolean;
    manualFilters?: boolean;
    manualPagination?: boolean;
    pageCount?: number;
    disableSorting?: boolean;
    defaultSortDesc?: boolean;
    disableMultiSort?: boolean;
    count?: number;
    disableSortRemove?: boolean;
    initialState?: any;
  }

  export interface RowsProps {
    subRowsKey: string;
  }

  export interface FiltersProps {
    filterFn: () => void;
    manualFilters: boolean;
    disableFilters: boolean;
    setFilter: (columnId: string, filter: string) => any;
    setAllFilters: (filterObj: any) => any;
  }

  export interface UsePaginationValues<D> {
    nextPage: () => any;
    previousPage: () => any;
    setPageSize: (size: number) => any;
    gotoPage: (page: number) => any;
    canPreviousPage: boolean;
    canNextPage: boolean;
    page: Page<D>;
    pageOptions: [];
  }

  export interface UseRowsValues<D> {
    rows: Array<Row<D>>;
  }

  export interface UseColumnsValues<D> {
    columns: Array<EnhancedColumn<D>>;
    headerGroups: Array<HeaderGroup<D>>;
    headers: Array<EnhancedColumn<D>>;
  }

  export interface UseFiltersValues {
    setFilter: (columnId: string, filter: string) => any;
    setAllFilters: (filterObj: any) => any;
  }

  export interface UseRowStateValues<D> {
    setRowState: (rowPath: string[], updater: (state: any) => any) => any;
  }

  export function useTable<D>(
    props: TableOptions<D>,
    ...plugins: any[]
  ): TableInstance<D>;

  export function useColumns<D>(
    props: TableOptions<D>,
  ): TableOptions<D> & UseColumnsValues<D>;

  export function useRows<D>(
    props: TableOptions<D>,
  ): TableOptions<D> & UseRowsValues<D>;

  export function useFilters<D>(
    props: TableOptions<D>,
  ): TableOptions<D> & {
    rows: Array<Row<D>>;
  };

  export function useSortBy<D>(
    props: TableOptions<D>,
  ): TableOptions<D> & {
    rows: Array<Row<D>>;
  };

  export function useGroupBy<D>(
    props: TableOptions<D>,
  ): TableOptions<D> & { rows: Array<Row<D>> };

  export function usePagination<D>(
    props: TableOptions<D>,
  ): UsePaginationValues<D>;

  export function useRowState<D>(props: TableOptions<D>): UseRowStateValues<D>;

  export function useFlexLayout<D>(props: TableOptions<D>): TableOptions<D>;

  export function useExpanded<D>(
    props: TableOptions<D>,
  ): TableOptions<D> & {
    toggleExpandedByPath: () => any;
    expandedDepth: [];
    rows: [];
  };

  export function useTableState(
    initialState?: any,
    overriddenState?: any,
    options?: {
      reducer?: (oldState: any, newState: any, type: string) => any;
      useState?: [any, Dispatch<SetStateAction<any>>];
    },
  ): any;

  export const actions: any;
}

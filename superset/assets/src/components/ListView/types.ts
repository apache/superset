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
export type SortColumn = {
  id: string;
  desc: boolean;
};

export type SortColumns = Array<SortColumn>;

export type Filter = {
  filterId: number;
  filterValue: string;
};

type FilterMap = {
  [columnId: string]: Filter;
};

export type FilterType = {
  label: string;
  value: any;
};

export type FetchDataConfig = {
  pageIndex: number;
  pageSize: number;
  sortBy: SortColumns;
  filters: FilterMap;
};

export type TableState = {
  getTableProps: () => any;
  getTableBodyProps: () => any;
  headerGroups: any;
  rows: any;
  prepareRow: (row: any) => void;
  canPreviousPage: boolean;
  canNextPage: boolean;
  pageCount: number;
  gotoPage: (page: number) => void;
  setFilter: (columnId: string, filter: Filter) => void;
  setAllFilters: (filters: FilterMap) => void;
  state: {
    pageIndex: number;
    pageSize: number;
    sortBy: SortColumns;
    filters: FilterMap;
  };
};

export type FilterToggle = {
  id: string;
  Header: string;
  filterId?: number;
  filterValue?: string;
};

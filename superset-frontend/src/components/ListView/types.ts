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
import { ReactNode } from 'react';

export interface SortColumn {
  id: string;
  desc?: boolean;
}

export type SortColumns = SortColumn[];

export interface SelectOption {
  label: string;
  value: any;
}

export interface CardSortSelectOption {
  desc: boolean;
  id: any;
  label: string;
  value: any;
}

export interface Filter {
  Header: ReactNode;
  id: string;
  urlDisplay?: string;
  operator?: FilterOperator;
  input?:
    | 'text'
    | 'textarea'
    | 'select'
    | 'checkbox'
    | 'search'
    | 'datetime_range';
  unfilteredLabel?: string;
  selects?: SelectOption[];
  onFilterOpen?: () => void;
  fetchSelects?: (
    filterValue: string,
    page: number,
    pageSize: number,
  ) => Promise<{ data: SelectOption[]; totalCount: number }>;
  paginate?: boolean;
}

export type Filters = Filter[];

export type ViewModeType = 'card' | 'table';

export interface FilterValue {
  id: string;
  urlDisplay?: string;
  operator?: string;
  value:
    | string
    | boolean
    | number
    | null
    | undefined
    | string[]
    | number[]
    | { label: string; value: string | number };
}

export interface FetchDataConfig {
  pageIndex: number;
  pageSize: number;
  sortBy: SortColumns;
  filters: FilterValue[];
}

export interface InternalFilter extends FilterValue {
  Header?: string;
}

export enum FilterOperator {
  startsWith = 'sw',
  endsWith = 'ew',
  contains = 'ct',
  equals = 'eq',
  notStartsWith = 'nsw',
  notEndsWith = 'new',
  notContains = 'nct',
  notEquals = 'neq',
  greaterThan = 'gt',
  lessThan = 'lt',
  relationManyMany = 'rel_m_m',
  relationOneMany = 'rel_o_m',
  titleOrSlug = 'title_or_slug',
  nameOrDescription = 'name_or_description',
  allText = 'all_text',
  chartAllText = 'chart_all_text',
  datasetIsNullOrEmpty = 'dataset_is_null_or_empty',
  between = 'between',
  dashboardIsFav = 'dashboard_is_favorite',
  chartIsFav = 'chart_is_favorite',
  chartIsCertified = 'chart_is_certified',
  dashboardIsCertified = 'dashboard_is_certified',
}

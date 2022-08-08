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

import { AdhocFilter, DataMask } from '@superset-ui/core';

export interface NativeFilterColumn {
  name: string;
  displayName?: string;
}

export interface NativeFilterScope {
  rootPath: string[];
  excluded: number[];
}

/** The target of a filter is the datasource/column being filtered */
export interface NativeFilterTarget {
  datasetId: number;
  column: NativeFilterColumn;

  // maybe someday support this?
  // show values from these columns in the filter options selector
  // clarityColumns?: Column[];
}

export enum NativeFilterType {
  NATIVE_FILTER = 'NATIVE_FILTER',
  DIVIDER = 'DIVIDER',
}

export enum DataMaskType {
  NativeFilters = 'nativeFilters',
  CrossFilters = 'crossFilters',
}

export type DataMaskState = { [id: string]: DataMask };

export type DataMaskWithId = { id: string } & DataMask;
export type DataMaskStateWithId = { [filterId: string]: DataMaskWithId };

export type FilterSet = {
  id: number;
  name: string;
  nativeFilters: Filters;
  dataMask: DataMaskStateWithId;
};

export type FilterSets = {
  [filtersSetId: string]: FilterSet;
};

export type Filter = {
  cascadeParentIds: string[];
  defaultDataMask: DataMask;
  id: string; // randomly generated at filter creation
  name: string;
  scope: NativeFilterScope;
  filterType: string;
  // for now there will only ever be one target
  // when multiple targets are supported, change this to Target[]
  targets: [Partial<NativeFilterTarget>];
  controlValues: {
    [key: string]: any;
  };
  sortMetric?: string | null;
  adhoc_filters?: AdhocFilter[];
  granularity_sqla?: string;
  granularity?: string;
  druid_time_origin?: string;
  time_grain_sqla?: string;
  time_range?: string;
  requiredFirst?: boolean;
  tabsInScope?: string[];
  chartsInScope?: number[];
  type: typeof NativeFilterType.NATIVE_FILTER;
  description: string;
};

export type Divider = Partial<Omit<Filter, 'id' | 'type'>> & {
  id: string;
  title: string;
  description: string;
  type: typeof NativeFilterType.DIVIDER;
};

export function isNativeFilter(
  filterElement: Filter | Divider,
): filterElement is Filter {
  return filterElement.type === NativeFilterType.NATIVE_FILTER;
}

export function isFilterDivider(
  filterElement: Filter | Divider,
): filterElement is Divider {
  return filterElement.type === NativeFilterType.DIVIDER;
}

export type FilterConfiguration = Array<Filter | Divider>;

export type Filters = {
  [filterId: string]: Filter | Divider;
};

export type NativeFiltersState = {
  filters: Filters;
  filterSets: FilterSets;
  focusedFilterId?: string;
};

export type DashboardComponentMetadata = {
  nativeFilters: NativeFiltersState;
  dataMask: DataMaskStateWithId;
};

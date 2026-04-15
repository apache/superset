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

export interface ColumnOption {
  label: string;
  value: string;
}

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
  NativeFilter = 'NATIVE_FILTER',
  Divider = 'DIVIDER',
}

export enum ChartCustomizationType {
  ChartCustomization = 'CHART_CUSTOMIZATION',
  Divider = 'CHART_CUSTOMIZATION_DIVIDER',
}

export enum DataMaskType {
  NativeFilters = 'nativeFilters',
  CrossFilters = 'crossFilters',
}

export type DataMaskState = { [id: string]: DataMask };

export type DataMaskWithId = { id: string } & DataMask;
export type DataMaskStateWithId = { [filterId: string]: DataMaskWithId };

export type Filter = {
  cascadeParentIds: string[];
  defaultDataMask: DataMask;
  id: string; // randomly generated at filter creation
  name: string;
  scope: NativeFilterScope;
  filterType: string;
  targets: Partial<NativeFilterTarget>[];
  controlValues: {
    [key: string]: any;
  };
  sortMetric?: string | null;
  adhoc_filters?: AdhocFilter[];
  granularity_sqla?: string;
  granularity?: string;
  time_grain_sqla?: string;
  time_range?: string;
  requiredFirst?: boolean;
  tabsInScope?: string[];
  chartsInScope?: number[];
  type: typeof NativeFilterType.NativeFilter;
  description: string;
};

export type ChartCustomization = {
  id: string;
  type: typeof ChartCustomizationType.ChartCustomization;
  name: string;
  filterType: string;
  targets: Partial<NativeFilterTarget>[];
  scope: NativeFilterScope;
  chartsInScope?: number[];
  tabsInScope?: string[];
  cascadeParentIds?: string[];
  defaultDataMask: DataMask;
  controlValues: {
    sortAscending?: boolean;
    sortMetric?: string;
    [key: string]: any;
  };
  description?: string;
  removed?: boolean;
};

export type ChartCustomizationDivider = Partial<
  Omit<ChartCustomization, 'id' | 'type'>
> & {
  id: string;
  title: string;
  description: string;
  type: typeof ChartCustomizationType.Divider;
};

export type AppliedFilter = {
  values: {
    filters: Record<string, any>[];
  } | null;
};

export type AppliedCrossFilterType = {
  filterType: undefined;
  targets: number[];
  scope: number[];
} & AppliedFilter;

export type AppliedNativeFilterType = {
  filterType: 'filter_select';
  scope: number[];
  targets: Partial<NativeFilterTarget>[];
} & AppliedFilter;

export type FilterWithDataMask = Filter & { dataMask: DataMaskWithId };

export type Divider = Partial<Omit<Filter, 'id' | 'type'>> & {
  id: string;
  title: string;
  description: string;
  type: typeof NativeFilterType.Divider;
};

export function isAppliedCrossFilterType(
  filterElement: AppliedCrossFilterType | AppliedNativeFilterType | Filter,
): filterElement is AppliedCrossFilterType {
  return (
    filterElement.filterType === undefined &&
    filterElement.hasOwnProperty('values')
  );
}

export function isAppliedNativeFilterType(
  filterElement: AppliedCrossFilterType | AppliedNativeFilterType | Filter,
): filterElement is AppliedNativeFilterType {
  return (
    filterElement.filterType === 'filter_select' &&
    filterElement.hasOwnProperty('values')
  );
}

export function isNativeFilter(
  filterElement: Filter | Divider,
): filterElement is Filter {
  return filterElement.type === NativeFilterType.NativeFilter;
}

export function isNativeFilterWithDataMask(
  filterElement: Filter | Divider,
): filterElement is FilterWithDataMask {
  return (
    isNativeFilter(filterElement) &&
    (filterElement as FilterWithDataMask).dataMask?.filterState?.value
  );
}

export function isFilterDivider(
  filterElement: Filter | Divider,
): filterElement is Divider {
  return filterElement.type === NativeFilterType.Divider;
}

export function isChartCustomization(
  filterElement:
    | Filter
    | Divider
    | ChartCustomization
    | ChartCustomizationDivider,
): filterElement is ChartCustomization {
  return filterElement.type === ChartCustomizationType.ChartCustomization;
}

export function isChartCustomizationDivider(
  filterElement: ChartCustomization | ChartCustomizationDivider,
): filterElement is ChartCustomizationDivider {
  return filterElement.type === ChartCustomizationType.Divider;
}

export type FilterConfiguration = Array<Filter | Divider>;

export type Filters = {
  [filterId: string]:
    | Filter
    | Divider
    | ChartCustomization
    | ChartCustomizationDivider;
};

export type PartialFilters = {
  [filterId: string]: Partial<Filters[keyof Filters]>;
};

export type NativeFiltersState = {
  filters: Filters;
  focusedFilterId?: string;
  hoveredFilterId?: string;
};

export type ChartCustomizationConfiguration = Array<
  ChartCustomization | ChartCustomizationDivider
>;

export type ChartCustomizations = {
  [chartCustomizationId: string]:
    | ChartCustomization
    | ChartCustomizationDivider;
};

export type PartialChartCustomizations = {
  [chartCustomizationId: string]: Partial<
    ChartCustomizations[keyof ChartCustomizations]
  >;
};

export type DashboardComponentMetadata = {
  nativeFilters: NativeFiltersState;
  dataMask: DataMaskStateWithId;
};

export interface LegacyChartCustomizationDataset {
  value: number | string;
  label: string;
  table_name?: string;
}

export interface LegacyChartCustomizationConfig {
  name: string;
  dataset: string | number | LegacyChartCustomizationDataset | null;
  column: string | string[] | null;
  sortAscending?: boolean;
  sortMetric?: string;
  canSelectMultiple?: boolean;
  defaultDataMask?: DataMask;
  controlValues?: {
    enableEmptyFilter?: boolean;
    [key: string]: any;
  };
  description?: string;
}

export interface LegacyChartCustomizationItem {
  id: string;
  title?: string;
  removed?: boolean;
  chartId?: number;
  customization: LegacyChartCustomizationConfig;
}

export default {};

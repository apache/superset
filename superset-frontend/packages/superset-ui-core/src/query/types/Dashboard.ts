// DODO was here

import { AdhocFilter, DataMask } from '@superset-ui/core';

interface NativeFilterColumnDodoExtended {
  id?: string; // DODO added 44211759
  nameRu?: string; // DODO added 44211759
}
export interface NativeFilterColumn extends NativeFilterColumnDodoExtended {
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

export enum DataMaskType {
  NativeFilters = 'nativeFilters',
  CrossFilters = 'crossFilters',
}

export type DataMaskState = { [id: string]: DataMask };

export type DataMaskWithId = { id: string } & DataMask;
export type DataMaskStateWithId = { [filterId: string]: DataMaskWithId };

// DODO added start 44211751
type FilterSetDodoExtended = {
  isPrimary: boolean;
};

export type FilterSet = {
  id: number;
  name: string;
  nativeFilters: Filters;
  dataMask: DataMaskStateWithId;
} & FilterSetDodoExtended;

export type FilterSets = {
  [filtersSetId: string]: FilterSet;
};
// DODO added stop 44211751

type FilterDodoExtended = {
  nameRu?: string; // DODO added 44211759
  selectTopValue?: number; // DODO added 44211759
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
  time_grain_sqla?: string;
  time_range?: string;
  requiredFirst?: boolean;
  tabsInScope?: string[];
  chartsInScope?: number[];
  type: typeof NativeFilterType.NativeFilter;
  description: string;
} & FilterDodoExtended;

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

export type FilterConfiguration = Array<Filter | Divider>;

export type Filters = {
  [filterId: string]: Filter | Divider;
};

export type PartialFilters = {
  [filterId: string]: Partial<Filters[keyof Filters]>;
};

type NativeFiltersStateDodoExtended = {
  filterSets: FilterSets; // DODO added 44211751
  pendingFilterSetId?: number; // DODO added 44211751
};
export type NativeFiltersState = {
  filters: Filters;
  focusedFilterId?: string;
  hoveredFilterId?: string;
} & NativeFiltersStateDodoExtended;

export type DashboardComponentMetadata = {
  nativeFilters: NativeFiltersState;
  dataMask: DataMaskStateWithId;
};

export default {};

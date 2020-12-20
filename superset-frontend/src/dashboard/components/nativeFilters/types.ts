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
import { ExtraFormData, QueryObjectFilterClause } from '@superset-ui/core';

export enum Scoping {
  all,
  specific,
}

interface NativeFiltersFormItem {
  scoping: Scoping;
  scope: Scope;
  name: string;
  dataset: {
    value: number;
    label: string;
  };
  column: string;
  defaultValue: string;
  parentFilter: {
    value: string;
    label: string;
  };
  inverseSelection: boolean;
  isInstant: boolean;
  allowsMultipleValues: boolean;
  isRequired: boolean;
}

export interface NativeFiltersForm {
  filters: Record<string, NativeFiltersFormItem>;
}

export interface Column {
  name: string;
  displayName?: string;
}

export interface Scope {
  rootPath: string[];
  excluded: number[];
}

/** The target of a filter is the datasource/column being filtered */
export interface Target {
  datasetId: number;
  column: Column;

  // maybe someday support this?
  // show values from these columns in the filter options selector
  // clarityColumns?: Column[];
}

export type FilterType = 'text' | 'date';

/**
 * This is a filter configuration object, stored in the dashboard's json metadata.
 * The values here do not reflect the current state of the filter.
 */
export interface Filter {
  allowsMultipleValues: boolean;
  cascadeParentIds: string[];
  defaultValue: string | null;
  currentValue?: (string | number | boolean)[] | null;
  inverseSelection: boolean;
  isInstant: boolean;
  isRequired: boolean;
  id: string; // randomly generated at filter creation
  name: string;
  scope: Scope;
  type: FilterType;
  // for now there will only ever be one target
  // when multiple targets are supported, change this to Target[]
  targets: [Target];
}

export interface CascadeFilter extends Filter {
  cascadeChildren: CascadeFilter[];
}

export type FilterConfiguration = Filter[];

export type SelectedValues = string[] | null;

/** Current state of the filter, stored in `nativeFilters` in redux */
export type FilterState = {
  id: string; // ties this filter state to the config object
  extraFormData?: ExtraFormData;
};

export type AllFilterState = {
  column: Column;
  datasetId: number;
  datasource: string;
  id: string;
  selectedValues: SelectedValues;
  filterClause?: QueryObjectFilterClause;
};

/** UI Ant tree type */
export type TreeItem = {
  children: TreeItem[];
  key: string;
  title: string;
};

export type NativeFiltersState = {
  filters: {
    [filterId: string]: Filter;
  };
  filtersState: {
    [filterId: string]: FilterState;
  };
};

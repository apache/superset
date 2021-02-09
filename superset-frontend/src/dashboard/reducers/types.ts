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

import componentTypes from 'src/dashboard/util/componentTypes';
import { ExtraFormData, JsonObject } from '@superset-ui/core';
import { Filter } from '../components/nativeFilters/types';

export enum Scoping {
  all,
  specific,
}

/** Chart state of redux */
export type Chart = {
  id: number;
  slice_id: string;
  formData: {
    viz_type: string;
  };
};

/** Root state of redux */
export type RootState = {
  charts: { [key: string]: Chart };
  dashboardLayout: { present: { [key: string]: LayoutItem } };
  dashboardFilters: {};
};

/** State of dashboardLayout in redux */
export type Layout = { [key: string]: LayoutItem };

/** State of nativeFilters currentState */
export type CurrentFilterState = JsonObject & {
  value: any;
};

/** State of charts in redux */
export type Charts = { [key: number]: Chart };

type ComponentTypesKeys = keyof typeof componentTypes;
export type ComponentType = typeof componentTypes[ComponentTypesKeys];

/** State of dashboardLayout item in redux */
export type LayoutItem = {
  children: string[];
  parents: string[];
  type: ComponentType;
  id: string;
  meta: {
    chartId: number;
    height: number;
    sliceName?: string;
    text?: string;
    uuid: string;
    width: number;
  };
};

/** Current state of the filter, stored in `nativeFilters` in redux */
export type NativeFilterState = {
  id: string; // ties this filter state to the config object
  extraFormData?: ExtraFormData;
  currentState?: CurrentFilterState;
};

export type FiltersSet = {
  id: string;
  name: string;
  filtersState: NativeFilterState;
};

export type FilterSets = {
  [filtersSetId: string]: FiltersSet;
};

export type NativeFiltersState = {
  filters: {
    [filterId: string]: Filter;
  };
  filterSets: FilterSets;
  filtersState: {
    [filterId: string]: NativeFilterState;
  };
};

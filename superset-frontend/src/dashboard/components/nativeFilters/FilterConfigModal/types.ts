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
import { QueryObjectFilterClause } from '@superset-ui/core';
import { Column, FilterType, Scope } from '../types';

export enum Scoping {
  all,
  specific,
}

// Using to pass setState React callbacks directly to And components
export type AntCallback = (value1?: any, value2?: any) => void;

export interface NativeFiltersFormItem {
  scope: Scope;
  name: string;
  filterType: FilterType;
  dataset: {
    value: number;
    label: string;
  };
  column: string;
  controlValues: {
    [key: string]: any;
  };
  defaultValue: any;
  parentFilter: {
    value: string;
    label: string;
  };
  isInstant: boolean;
}

export interface NativeFiltersForm {
  filters: Record<string, NativeFiltersFormItem>;
}

export type SelectedValues = string[] | null;

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

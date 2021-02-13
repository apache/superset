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

export interface Column {
  name: string;
  displayName?: string;
}

export interface Scope {
  rootPath: string[];
  excluded: number[];
}

export enum FilterType {
  filter_select = 'filter_select',
  filter_range = 'filter_range',
  filter_time = 'filter_time',
}

/** The target of a filter is the datasource/column being filtered */
export interface Target {
  datasetId: number;
  column: Column;

  // maybe someday support this?
  // show values from these columns in the filter options selector
  // clarityColumns?: Column[];
}

export interface Filter {
  allowsMultipleValues: boolean;
  cascadeParentIds: string[];
  defaultValue: any;
  currentValue?: any;
  inverseSelection: boolean;
  isInstant: boolean;
  isRequired: boolean;
  id: string; // randomly generated at filter creation
  name: string;
  scope: Scope;
  filterType: FilterType;
  // for now there will only ever be one target
  // when multiple targets are supported, change this to Target[]
  targets: [Target];
}

export type FilterConfiguration = Filter[];

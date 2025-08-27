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
import { DataMask } from '@superset-ui/core';

interface DatasetReference {
  value: string | number;
  label?: string;
  table_name?: string;
  schema?: string;
}

export interface ColumnOption {
  label: string;
  value: string;
}

export interface GroupByCustomization {
  name: string;
  dataset: string | number | DatasetReference | null;
  datasetInfo?: {
    label: string;
    value: number;
    table_name: string;
  };
  column: string | string[] | null;
  description?: string;
  sortFilter?: boolean;
  sortAscending?: boolean;
  sortMetric?: string;
  hasDefaultValue?: boolean;
  defaultValue?: string;
  isRequired?: boolean;
  selectFirst?: boolean;
  defaultDataMask?: DataMask;
  defaultValueQueriesData?: ColumnOption[] | null;
  aggregation?: string;
  canSelectMultiple?: boolean;
  controlValues?: {
    enableEmptyFilter?: boolean;
  };
}

export interface FilterOption {
  label: string;
  value: string;
}

export interface ChartCustomizationItem {
  id: string;
  title?: string;
  removed?: boolean;
  dataset?: string | null;
  description?: string;
  removeTimerId?: number;
  chartId?: number;
  settings?: {
    sortFilter: boolean;
    hasDefaultValue: boolean;
    isRequired: boolean;
    selectFirstByDefault: boolean;
  };
  customization: GroupByCustomization;
}

export interface ChartCustomizationChangesType {
  modified: string[];
  deleted: string[];
  reordered: string[];
}

export interface ChartCustomizationRemoval {
  isPending: boolean;
  timerId: number;
}

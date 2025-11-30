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
import { FilterState, QueryFormData } from '@superset-ui/core';
import { RefObject } from 'react';
import type { RefSelectProps } from '@superset-ui/core/components';
import { PluginFilterHooks, PluginFilterStylesProps } from '../types';

export interface DatasetReference {
  value: string | number;
  label?: string;
  table_name?: string;
  schema?: string;
}

export interface ColumnOption {
  label: string;
  value: string;
}

interface PluginFilterGroupByCustomizeProps {
  dataset?: string | number | DatasetReference | null;
  datasetInfo?: {
    label: string;
    value: number;
    table_name: string;
  };
  column?: string | string[] | null;
  description?: string;
  sortFilter?: boolean;
  sortAscending?: boolean;
  sortMetric?: string;
  hasDefaultValue?: boolean;
  defaultValue?: string | string[] | null;
  isRequired?: boolean;
  selectFirst?: boolean;
  canSelectMultiple?: boolean;
  aggregation?: string;
  enableEmptyFilter?: boolean;
  inputRef?: RefObject<HTMLInputElement>;
}

export type PluginFilterGroupByQueryFormData = QueryFormData &
  PluginFilterStylesProps &
  PluginFilterGroupByCustomizeProps;

export interface ColumnData {
  column_name: string;
  verbose_name?: string | null;
  dtype?: number;
}

export type PluginFilterGroupByProps = PluginFilterStylesProps & {
  data: (ColumnOption | ColumnData)[];
  filterState: FilterState;
  formData: PluginFilterGroupByQueryFormData;
  inputRef: RefObject<RefSelectProps>;
} & PluginFilterHooks;

export const DEFAULT_FORM_DATA: PluginFilterGroupByCustomizeProps = {
  dataset: null,
  column: null,
  sortFilter: false,
  sortAscending: true,
  canSelectMultiple: true,
  defaultValue: null,
};

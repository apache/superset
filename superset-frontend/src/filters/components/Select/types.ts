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
import {
  AppSection,
  ChartProps,
  Behavior,
  DataRecord,
  GenericDataType,
  QueryFormData,
  SetDataMaskHook,
  ChartDataResponseResult,
} from '@superset-ui/core';
import { RefObject } from 'react';
import { PluginFilterStylesProps } from '../types';

export const FIRST_VALUE = '__FIRST_VALUE__';
export type SelectValue = (number | string)[] | null;

interface PluginFilterSelectCustomizeProps {
  defaultValue?: SelectValue | typeof FIRST_VALUE;
  currentValue?: SelectValue | typeof FIRST_VALUE;
  enableEmptyFilter: boolean;
  inverseSelection: boolean;
  multiSelect: boolean;
  defaultToFirstItem: boolean;
  inputRef?: RefObject<HTMLInputElement>;
  sortAscending: boolean;
}

export type PluginFilterSelectQueryFormData = QueryFormData &
  PluginFilterStylesProps &
  PluginFilterSelectCustomizeProps;

export interface PluginFilterSelectChartProps extends ChartProps {
  queriesData: ChartDataResponseResult[];
}

export type PluginFilterSelectProps = PluginFilterStylesProps & {
  coltypeMap: Record<string, GenericDataType>;
  data: DataRecord[];
  setDataMask: SetDataMaskHook;
  behaviors: Behavior[];
  appSection: AppSection;
  formData: PluginFilterSelectQueryFormData;
};

export const DEFAULT_FORM_DATA: PluginFilterSelectCustomizeProps = {
  defaultValue: null,
  currentValue: null,
  enableEmptyFilter: false,
  inverseSelection: false,
  defaultToFirstItem: false,
  multiSelect: true,
  sortAscending: true,
};

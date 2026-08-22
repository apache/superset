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
  QueryFormData,
  TimeseriesDataRecord,
  DataMask,
} from '@superset-ui/core';
import { SupersetTheme } from '@apache-superset/core/theme';
import { FilterBarOrientation } from 'src/dashboard/types';

export interface CheckboxRadioStylesProps {
  height: number;
  width: number;
}

export type ControlType = 'Checkbox' | 'Radio';

export interface PluginFilterCheckboxRadioQueryFormData extends QueryFormData {
  controlType: ControlType;
  filterColumn?:
    | string
    | { label?: string; column_name?: string; sqlExpression?: string };
  orientation?: 'vertical' | 'horizontal';
  enableEmptyFilter?: boolean;
  controlValues?: Record<string, unknown>;
  inCanvas?: boolean;
}

export interface PluginFilterCheckboxRadioProps extends CheckboxRadioStylesProps {
  data: TimeseriesDataRecord[];
  controlType: ControlType;
  filterColumn?:
    | string
    | { label?: string; column_name?: string; sqlExpression?: string };
  orientation?: 'vertical' | 'horizontal';
  inCanvas?: boolean;
  filterBarOrientation?: FilterBarOrientation;
  isOverflowingFilterBar?: boolean;
  setDataMask: (dataMask: DataMask) => void;
  filterState?: {
    value?: unknown;
    validateMessage?: string;
    validateStatus?: '' | 'success' | 'warning' | 'error' | 'validating';
  };
  theme?: SupersetTheme;
}

export type CheckboxRadioTransformedProps = PluginFilterCheckboxRadioProps;

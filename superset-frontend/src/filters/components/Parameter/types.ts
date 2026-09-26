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
  DataMask,
  FilterState,
  JsonObject,
} from '@superset-ui/core';
import { PluginFilterStylesProps } from '../types';

export type ParameterType =
  | 'string'
  | 'integer'
  | 'float'
  | 'boolean';

export interface PluginFilterParameterFormData extends JsonObject {
  parameter_name?: string;
  parameterName?: string;
  parameter_type?: ParameterType;
  parameterType?: ParameterType;
  defaultValue?: string | number | boolean | null;
}

export type PluginFilterParameterProps = PluginFilterStylesProps & {
  data: JsonObject[];
  formData: PluginFilterParameterFormData;
  setDataMask: (mask: DataMask) => void;
  setHoveredFilter?: () => void;
  unsetHoveredFilter?: () => void;
  setFocusedFilter?: () => void;
  unsetFocusedFilter?: () => void;
  setFilterActive?: (isActive: boolean) => void;
  filterState: FilterState;
  inputRef?: React.RefObject<any>;
};

export const DEFAULT_FORM_DATA: PluginFilterParameterFormData = {
  parameter_name: '',
  parameter_type: 'string',
  defaultValue: null,
};


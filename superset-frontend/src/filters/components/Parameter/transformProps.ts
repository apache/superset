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
import { ChartProps } from '@superset-ui/core';
import { noOp } from 'src/utils/common';
import {
  DEFAULT_FORM_DATA,
  PluginFilterParameterFormData,
  PluginFilterParameterProps,
} from './types';

export default function transformProps(
  chartProps: ChartProps,
): PluginFilterParameterProps {
  const {
    formData,
    rawFormData,
    height,
    hooks,
    filterState,
    inputRef,
    width,
  } = chartProps;
  const {
    setDataMask = noOp,
    setHoveredFilter = noOp,
    unsetHoveredFilter = noOp,
    setFocusedFilter = noOp,
    unsetFocusedFilter = noOp,
    setFilterActive = noOp,
  } = hooks;

  const raw = (rawFormData || {}) as any;
  const fd = (formData || {}) as any;

  let resolvedType =
    raw.parameter_type ||
    fd.parameterType ||
    fd.parameter_type ||
    'string';
  if (resolvedType === 'decimal') resolvedType = 'float';
  if (resolvedType === 'number') resolvedType = 'integer';

  const resolvedFormData: PluginFilterParameterFormData = {
    ...DEFAULT_FORM_DATA,
    ...fd,
    parameter_name:
      raw.parameter_name ||
      fd.parameterName ||
      fd.parameter_name ||
      fd.name ||
      '',
    parameter_type: resolvedType,
  };

  return {
    filterState,
    width,
    height,
    data: [],
    formData: resolvedFormData,
    setDataMask,
    setHoveredFilter,
    unsetHoveredFilter,
    setFocusedFilter,
    unsetFocusedFilter,
    setFilterActive,
    inputRef,
  };
}

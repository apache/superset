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
import { DEFAULT_FORM_DATA } from './types';

export default function transformProps(chartProps: ChartProps) {
  const {
    behaviors,
    formData,
    height,
    hooks,
    queriesData,
    width,
    filterState,
    inputRef,
  } = chartProps;
  const {
    setDataMask = noOp,
    setHoveredFilter = noOp,
    unsetHoveredFilter = noOp,
    setFocusedFilter = noOp,
    unsetFocusedFilter = noOp,
    setFilterActive = noOp,
  } = hooks;

  const { data } = queriesData[0];

  return {
    filterState,
    behaviors,
    width,
    height,
    data,
    formData: { ...DEFAULT_FORM_DATA, ...formData },
    setDataMask,
    setHoveredFilter,
    unsetHoveredFilter,
    setFocusedFilter,
    unsetFocusedFilter,
    setFilterActive,
    inputRef,
  };
}

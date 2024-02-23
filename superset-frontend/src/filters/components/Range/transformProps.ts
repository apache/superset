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

export default function transformProps(chartProps: ChartProps) {
  const {
    formData,
    height,
    hooks,
    queriesData,
    width,
    behaviors,
    filterState,
    inputRef,
    displaySettings,
  } = chartProps;
  const {
    setDataMask = noOp,
    setFocusedFilter = noOp,
    unsetFocusedFilter = noOp,
    setHoveredFilter = noOp,
    unsetHoveredFilter = noOp,
    setFilterActive = noOp,
  } = hooks;
  const { data } = queriesData[0];

  return {
    data,
    formData,
    behaviors,
    height,
    setDataMask,
    filterState,
    width,
    setHoveredFilter,
    unsetHoveredFilter,
    setFocusedFilter,
    unsetFocusedFilter,
    setFilterActive,
    inputRef,
    isOverflowingFilterBar: displaySettings?.isOverflowingFilterBar,
    filterBarOrientation: displaySettings?.filterBarOrientation,
  };
}

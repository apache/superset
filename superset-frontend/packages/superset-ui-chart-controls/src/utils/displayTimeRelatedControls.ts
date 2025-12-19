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
import { isAdhocColumn, isPhysicalColumn } from '@superset-ui/core';
import type { ColumnMeta, ControlPanelsContainerProps } from '../types';

export function displayTimeRelatedControls({
  controls,
}: ControlPanelsContainerProps) {
  if (!controls?.x_axis) {
    return true;
  }

  const xAxis = controls?.x_axis;
  const xAxisValue = xAxis?.value;
  if (isAdhocColumn(xAxisValue)) {
    return true;
  }
  if (isPhysicalColumn(xAxisValue)) {
    return !!(xAxis?.options ?? []).find(
      (col: ColumnMeta) => col?.column_name === xAxisValue,
    )?.is_dttm;
  }
  return false;
}

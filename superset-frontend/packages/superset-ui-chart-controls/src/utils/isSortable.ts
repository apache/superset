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
  GenericDataType,
  getColumnLabel,
  isPhysicalColumn,
  QueryFormColumn,
} from '@superset-ui/core';
import { checkColumnType, ControlStateMapping } from '..';

export function isSortable(controls: ControlStateMapping): boolean {
  const isForcedCategorical =
    checkColumnType(
      getColumnLabel(controls?.x_axis?.value as QueryFormColumn),
      controls?.datasource?.datasource,
      [GenericDataType.Numeric],
    ) && !!controls?.xAxisForceCategorical?.value;

  const xAxisValue = controls?.x_axis?.value as QueryFormColumn;

  // Given that we don't know the type of a custom SQL column,
  // we treat it as sortable and give the responsibility to the
  // user to provide a sortable result.
  const isCustomSQL = !isPhysicalColumn(xAxisValue);

  return (
    isForcedCategorical ||
    isCustomSQL ||
    checkColumnType(
      getColumnLabel(xAxisValue),
      controls?.datasource?.datasource,
      [GenericDataType.String, GenericDataType.Boolean],
    )
  );
}

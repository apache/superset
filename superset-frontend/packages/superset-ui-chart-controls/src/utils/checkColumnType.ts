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
import { ensureIsArray, GenericDataType, ValueOf } from '@superset-ui/core';
import {
  ControlPanelState,
  isDataset,
  isQueryResponse,
} from '@superset-ui/chart-controls';

export function checkColumnType(
  columnName: string,
  datasource: ValueOf<Pick<ControlPanelState, 'datasource'>>,
  columnTypes: GenericDataType[],
): boolean {
  if (isDataset(datasource)) {
    return ensureIsArray(datasource.columns).some(
      c =>
        c.type_generic !== undefined &&
        columnTypes.includes(c.type_generic) &&
        columnName === c.column_name,
    );
  }
  if (isQueryResponse(datasource)) {
    return ensureIsArray(datasource.columns)
      .filter(
        c =>
          c.type_generic !== undefined && columnTypes.includes(c.type_generic),
      )
      .map(c => c.column_name)
      .some(c => columnName === c);
  }
  return false;
}

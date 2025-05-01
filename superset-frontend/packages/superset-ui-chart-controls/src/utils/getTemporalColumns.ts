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
  ensureIsArray,
  isDefined,
  QueryColumn,
  ValueOf,
} from '@superset-ui/core';
import {
  ColumnMeta,
  ControlPanelState,
  isDataset,
  isQueryResponse,
} from '@superset-ui/chart-controls';

export function getTemporalColumns(
  datasource: ValueOf<Pick<ControlPanelState, 'datasource'>>,
) {
  const rv: {
    temporalColumns: ColumnMeta[] | QueryColumn[];
    defaultTemporalColumn: string | null | undefined;
  } = {
    temporalColumns: [],
    defaultTemporalColumn: undefined,
  };

  if (isDataset(datasource)) {
    rv.temporalColumns = ensureIsArray(datasource.columns).filter(
      c => c.is_dttm,
    );
  }
  if (isQueryResponse(datasource)) {
    rv.temporalColumns = ensureIsArray(datasource.columns).filter(
      c => c.is_dttm,
    );
  }

  if (isDataset(datasource)) {
    rv.defaultTemporalColumn = datasource.main_dttm_col;
  }
  if (!isDefined(rv.defaultTemporalColumn)) {
    rv.defaultTemporalColumn =
      (rv.temporalColumns[0] as ColumnMeta)?.column_name ??
      (rv.temporalColumns[0] as QueryColumn)?.name;
  }

  return rv;
}

export function isTemporalColumn(
  columnName: string,
  datasource: ValueOf<Pick<ControlPanelState, 'datasource'>>,
): boolean {
  const columns = getTemporalColumns(datasource).temporalColumns;
  for (let i = 0; i < columns.length; i += 1) {
    if (columns[i].column_name === columnName) {
      return true;
    }
  }
  return false;
}

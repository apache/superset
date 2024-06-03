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
import { GenericDataType, QueryColumn, QueryResponse } from '@superset-ui/core';
import { ColumnMeta, Dataset, isDataset, isQueryResponse } from '../types';

export function columnsByType(
  datasource?: Dataset | QueryResponse | null,
  type?: GenericDataType,
): (ColumnMeta | QueryColumn)[] {
  if (isDataset(datasource) || isQueryResponse(datasource)) {
    const columns = datasource.columns as (ColumnMeta | QueryColumn)[];
    const filteredColumns = columns.filter(
      col => type === undefined || col.type_generic === type,
    );
    return filteredColumns.sort(
      (col1: ColumnMeta | QueryColumn, col2: ColumnMeta | QueryColumn) => {
        const opt1Name =
          'verbose_name' in col1
            ? col1.verbose_name || col1.column_name
            : col1.column_name;
        const opt2Name =
          'verbose_name' in col2
            ? col2.verbose_name || col2.column_name
            : col2.column_name;
        return opt1Name.toLowerCase() > opt2Name.toLowerCase() ? 1 : -1;
      },
    );
  }
  return [];
}

/**
 * Convert Datasource columns to column choices
 */
export default function columnChoices(
  datasource?: Dataset | QueryResponse | null,
  type?: GenericDataType,
): [string, string][] {
  return columnsByType(datasource, type).map(
    (col: ColumnMeta | QueryColumn): [string, string] => [
      col.column_name,
      'verbose_name' in col
        ? col.verbose_name || col.column_name
        : col.column_name,
    ],
  );
}

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

/**
 * Convert Datasource columns to column choices
 */
export default function columnChoices(
  datasource?: Dataset | QueryResponse | null,
  type?: GenericDataType,
): [string, string][] {
  if (isDataset(datasource) || isQueryResponse(datasource)) {
    const { columns } = datasource;
    const filteredColumns = (
      columns as { type_generic?: GenericDataType }[]
    ).filter(col => (type !== undefined ? col.type_generic === type : true));
    return filteredColumns
      .map((col: ColumnMeta | QueryColumn): [string, string] => [
        col.column_name,
        'verbose_name' in col
          ? col.verbose_name || col.column_name
          : col.column_name,
      ])
      .sort((opt1: [string, string], opt2: [string, string]) =>
        opt1[1].toLowerCase() > opt2[1].toLowerCase() ? 1 : -1,
      );
  }
  return [];
}

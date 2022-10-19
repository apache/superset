/* eslint-disable camelcase */
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

import { GenericDataType } from './QueryResponse';
import { QueryFormColumn } from './QueryFormData';

export interface AdhocColumn {
  hasCustomLabel?: boolean;
  label?: string;
  optionName?: string;
  sqlExpression: string;
  expressionType: 'SQL';
  columnType?: 'BASE_AXIS' | 'SERIES';
  timeGrain?: string;
  datasourceWarning?: boolean;
}

/**
 * A column that is physically defined in datasource.
 */
export type PhysicalColumn = string;

/**
 * Column information defined in datasource.
 */
export interface Column {
  id?: number;
  type?: string;
  type_generic?: GenericDataType;
  column_name: string;
  groupby?: boolean;
  is_dttm?: boolean;
  filterable?: boolean;
  verbose_name?: string | null;
  description?: string | null;
  expression?: string | null;
  database_expression?: string | null;
  python_date_format?: string | null;

  // used for advanced_data_type
  optionName?: string;
  filterBy?: string;
  value?: string;
  advanced_data_type?: string;
}

export function isPhysicalColumn(column?: any): column is PhysicalColumn {
  return typeof column === 'string';
}

export function isAdhocColumn(column?: any): column is AdhocColumn {
  return (
    typeof column !== 'string' &&
    column?.sqlExpression !== undefined &&
    column?.label !== undefined &&
    (column?.expressionType === undefined || column?.expressionType === 'SQL')
  );
}

export function isQueryFormColumn(column: any): column is QueryFormColumn {
  return isPhysicalColumn(column) || isAdhocColumn(column);
}

export default {};

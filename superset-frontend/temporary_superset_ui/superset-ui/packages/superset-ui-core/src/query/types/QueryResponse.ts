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
/**
 * Generic data types, see enum of the same name in superset/utils/core.py.
 */
export enum GenericDataType {
  NUMERIC = 0,
  STRING = 1,
  TEMPORAL = 2,
  BOOLEAN = 3,
}

/**
 * Primitive types for data field values.
 */
export type DataRecordValue = number | string | boolean | Date | null;

export interface DataRecord {
  [key: string]: DataRecordValue;
}

export interface ChartDataResponseResult {
  cache_key: string | null;
  cache_timeout: number | null;
  cache_dttm: string | null;
  /**
   * Array of data records as dictionary
   */
  data: DataRecord[];
  /**
   * Name of each column, for retaining the order of the output columns.
   */
  columns: string[];
  /**
   * Generic data types, based on the final output pandas dataframe.
   */
  dtypes: GenericDataType[];
  error: string | null;
  is_cached: boolean;
  query: string;
  rowcount: number;
  stacktrace: string | null;
  status: 'stopped' | 'failed' | 'pending' | 'running' | 'scheduled' | 'success' | 'timed_out';
}

/**
 * Query response from /api/v1/chart/data
 */
export interface ChartDataResponse {
  result: ChartDataResponseResult[];
}

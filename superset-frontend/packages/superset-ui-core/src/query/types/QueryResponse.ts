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

import { TimeseriesDataRecord } from '../../chart';
import { AnnotationData } from './AnnotationLayer';

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

/**
 * Queried data for charts. The `queries` field from `POST /chart/data`.
 * See superset/charts/schemas.py for the class of the same name.
 */
export interface ChartDataResponseResult {
  /**
   * Data for the annotation layer.
   */
  annotation_data: AnnotationData[] | null;
  cache_key: string | null;
  cache_timeout: number | null;
  cached_dttm: string | null;
  /**
   * Array of data records as dictionary
   */
  data: DataRecord[];
  /**
   * Name of each column, for retaining the order of the output columns.
   */
  colnames: string[];
  /**
   * Generic data types, based on the final output pandas dataframe.
   */
  coltypes: GenericDataType[];
  error: string | null;
  is_cached: boolean;
  query: string;
  rowcount: number;
  stacktrace: string | null;
  status:
    | 'stopped'
    | 'failed'
    | 'pending'
    | 'running'
    | 'scheduled'
    | 'success'
    | 'timed_out';
  from_dttm: number | null;
  to_dttm: number | null;
}

export interface TimeseriesChartDataResponseResult
  extends ChartDataResponseResult {
  data: TimeseriesDataRecord[];
}

/**
 * Query response from /api/v1/chart/data
 */
export interface ChartDataResponse {
  queries: ChartDataResponseResult[];
}

export default {};

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
  DataRecord,
  HandlerFunction,
  QueryFormColumn,
  QueryFormData,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';

export const WORKBOOK_CONTROL = 'univer_workbook';

export type UniverQueryFormData = QueryFormData & {
  /** JSON string of the saved spreadsheet, see `UniverSavedState` */
  univer_workbook?: string | null;
  univer_live_data?: boolean;
  univer_show_headers?: boolean;
  univer_pivot_rows?: QueryFormColumn[];
  univer_pivot_columns?: QueryFormColumn[];
  univer_pivot_totals?: boolean;
  univer_row_grouping?: boolean;
};

export interface UniverChartProps {
  width: number;
  height: number;
  data: DataRecord[];
  colnames: string[];
  coltypes: GenericDataType[];
  /** Column labels for the header row (verbose names) */
  labels: Record<string, string>;
  /** true in Explore: full editor; false on dashboards: read-only grid */
  editable: boolean;
  savedState: string | null;
  liveData: boolean;
  showHeaders: boolean;
  /**
   * In pivot mode, the number of row fields: the query result's first
   * columns. The other columns hold the values, see `buildPivotGrid`.
   */
  pivotRows?: number;
  /**
   * How many of the first columns identify a row (the dimensions), used to
   * keep row groups on the same rows when the data changes. All columns
   * when not set.
   */
  keyColumns?: number;
  /** group the rows by their first `keyColumns` columns, see groupRows */
  rowGrouping?: boolean;
  setControlValue?: HandlerFunction;
}

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
  QueryFormData,
  DataRecord,
  SetDataMaskHook,
  DataRecordValue,
  JsonObject,
  TimeFormatter,
  NumberFormatter,
  QueryFormMetric,
  QueryFormColumn,
  TimeGranularity,
  ContextMenuFilters,
  Currency,
} from '@superset-ui/core';
import { ColorFormatters } from '@superset-ui/chart-controls';

export interface PivotTableStylesProps {
  height: number;
  width: number | string;
  margin: number;
}

export type FilterType = Record<string, DataRecordValue>;
export type SelectedFiltersType = Record<string, DataRecordValue[]>;

export type DateFormatter =
  | TimeFormatter
  | NumberFormatter
  | ((value: DataRecordValue) => string);
export enum MetricsLayoutEnum {
  ROWS = 'ROWS',
  COLUMNS = 'COLUMNS',
}

/**
 * Display mode for pivot cell values: raw values, or each value expressed as
 * a fraction of its row/column/grand total. The division itself is a
 * presentational transform applied at render time against the already
 * DB-correct rollup totals (see `PivotData` in
 * `react-pivottable/utilities.ts`), but a percent mode does need its
 * denominator level queried even if the corresponding Total/subtotal display
 * toggle is off; see `buildGroupbyCombinations` in `plugin/utilities.ts`.
 */
export enum ShowValuesAsEnum {
  ACTUAL = 'actual',
  PERCENT_OF_ROW = 'percent_row',
  PERCENT_OF_COLUMN = 'percent_col',
  PERCENT_OF_TOTAL = 'percent_total',
}

/**
 * One rollup level for non-additive totals: a prefix of the row dimensions and
 * a prefix of the column dimensions. See `plugin/utilities.ts`.
 */
export interface Groupby {
  rows: QueryFormColumn[];
  columns: QueryFormColumn[];
}

/**
 * The result of one rollup-level query: the rows the database returned for that
 * level, tagged with the level (`groupby`) they belong to so the pivot can slot
 * each pre-computed value into the right cell/subtotal/total.
 */
export interface QueryData {
  data: DataRecord[];
  groupby: Groupby;
}

interface PivotTableCustomizeProps {
  groupbyRows: QueryFormColumn[];
  groupbyColumns: QueryFormColumn[];
  metrics: QueryFormMetric[];
  tableRenderer: string;
  colOrder: string;
  rowOrder: string;
  transposePivot: boolean;
  combineMetric: boolean;
  rowSubtotalPosition: boolean;
  colSubtotalPosition: boolean;
  colTotals: boolean;
  colSubTotals: boolean;
  rowTotals: boolean;
  rowSubTotals: boolean;
  valueFormat: string;
  currencyFormat: Currency;
  currencyCodeColumn?: string;
  detectedCurrency?: string | null;
  setDataMask: SetDataMaskHook;
  emitCrossFilters?: boolean;
  selectedFilters?: SelectedFiltersType;
  verboseMap: JsonObject;
  columnFormats: JsonObject;
  currencyFormats: Record<string, Currency>;
  metricsLayout?: MetricsLayoutEnum;
  showValuesAs?: ShowValuesAsEnum;
  metricColorFormatters: ColorFormatters;
  dateFormatters: Record<string, DateFormatter | undefined>;
  legacy_order_by: QueryFormMetric[] | QueryFormMetric | null;
  order_desc: boolean;
  onContextMenu?: (
    clientX: number,
    clientY: number,
    filters?: ContextMenuFilters,
  ) => void;
  timeGrainSqla?: TimeGranularity;
  time_grain_sqla?: TimeGranularity;
  granularity_sqla?: string;
  allowRenderHtml?: boolean;
}

export type PivotTableQueryFormData = QueryFormData &
  PivotTableStylesProps &
  PivotTableCustomizeProps;

export type PivotTableProps = PivotTableStylesProps &
  PivotTableCustomizeProps & {
    data: QueryData[];
  };

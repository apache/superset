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

interface PivotTableCustomizeProps {
  groupbyRows: QueryFormColumn[];
  groupbyColumns: QueryFormColumn[];
  metrics: QueryFormMetric[];
  tableRenderer: string;
  colOrder: string;
  rowOrder: string;
  aggregateFunction: string;
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
  setDataMask: SetDataMaskHook;
  emitCrossFilters?: boolean;
  selectedFilters?: SelectedFiltersType;
  verboseMap: JsonObject;
  columnFormats: JsonObject;
  currencyFormats: Record<string, Currency>;
  metricsLayout?: MetricsLayoutEnum;
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
    data: DataRecord[];
  };

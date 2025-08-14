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
import { ColorFormatters } from '@superset-ui/chart-controls';
import {
  NumberFormatter,
  TimeFormatter,
  TimeGranularity,
  QueryFormMetric,
  ChartProps,
  DataRecord,
  DataRecordValue,
  DataRecordFilters,
  GenericDataType,
  QueryMode,
  ChartDataResponseResult,
  QueryFormData,
  SetDataMaskHook,
  CurrencyFormatter,
  Currency,
  JsonObject,
  Metric,
} from '@superset-ui/core';
import {
  ColDef,
  Column,
  IHeaderParams,
  CustomCellRendererProps,
} from '@superset-ui/core/components/ThemedAgGridReact';

export type CustomFormatter = (value: DataRecordValue) => string;

export type TableColumnConfig = {
  d3NumberFormat?: string;
  d3SmallNumberFormat?: string;
  d3TimeFormat?: string;
  columnWidth?: number;
  horizontalAlign?: 'left' | 'right' | 'center';
  showCellBars?: boolean;
  alignPositiveNegative?: boolean;
  colorPositiveNegative?: boolean;
  truncateLongCells?: boolean;
  currencyFormat?: Currency;
  visible?: boolean;
  customColumnName?: string;
  displayTypeIcon?: boolean;
};

export interface DataColumnMeta {
  // `key` is what is called `label` in the input props
  key: string;
  // `label` is verbose column name used for rendering
  label: string;
  // `originalLabel` preserves the original label when time comparison transforms the labels
  originalLabel?: string;
  dataType: GenericDataType;
  formatter?:
    | TimeFormatter
    | NumberFormatter
    | CustomFormatter
    | CurrencyFormatter;
  isMetric?: boolean;
  isPercentMetric?: boolean;
  isNumeric?: boolean;
  config?: TableColumnConfig;
  isChildColumn?: boolean;
}

export interface TableChartData {
  records: DataRecord[];
  columns: string[];
}

export type TableChartFormData = QueryFormData & {
  align_pn?: boolean;
  color_pn?: boolean;
  include_time?: boolean;
  include_search?: boolean;
  query_mode?: QueryMode;
  page_length?: string | number | null; // null means auto-paginate
  metrics?: QueryFormMetric[] | null;
  percent_metrics?: QueryFormMetric[] | null;
  timeseries_limit_metric?: QueryFormMetric[] | QueryFormMetric | null;
  groupby?: QueryFormMetric[] | null;
  all_columns?: QueryFormMetric[] | null;
  order_desc?: boolean;
  show_cell_bars?: boolean;
  table_timestamp_format?: string;
  time_grain_sqla?: TimeGranularity;
  column_config?: Record<string, TableColumnConfig>;
  allow_rearrange_columns?: boolean;
};

export interface TableChartProps extends ChartProps {
  ownCurrentState?: {
    pageSize?: number;
    currentPage?: number;
  };
  rawFormData: TableChartFormData;
  queriesData: ChartDataResponseResult[];
}

export type BasicColorFormatterType = {
  backgroundColor: string;
  arrowColor: string;
  mainArrow: string;
};

export type SortByItem = {
  id: string;
  key: string;
  desc?: boolean;
};

export type SearchOption = {
  value: string;
  label: string;
};

export interface ServerPaginationData {
  pageSize?: number;
  currentPage?: number;
  sortBy?: SortByItem[];
  searchText?: string;
  searchColumn?: string;
}

export interface AgGridTableChartTransformedProps<
  D extends DataRecord = DataRecord,
> {
  height: number;
  width: number;

  setDataMask: SetDataMaskHook;
  data: D[];
  columns: DataColumnMeta[];
  pageSize?: number;
  sortDesc?: boolean;
  includeSearch?: boolean;
  filters?: DataRecordFilters;
  emitCrossFilters?: boolean;
  allowRearrangeColumns?: boolean;
  allowRenderHtml?: boolean;
  slice_id: number;
  serverPagination: boolean;
  rowCount: number;
  serverPaginationData: JsonObject;
  percentMetrics: string[];
  hasServerPageLengthChanged: boolean;
  serverPageLength: number;
  hasPageLength: boolean;
  timeGrain: TimeGranularity | undefined;
  isRawRecords: boolean;
  alignPositiveNegative: boolean;
  showCellBars: boolean;
  isUsingTimeComparison: boolean;
  colorPositiveNegative: boolean;
  totals: DataRecord | undefined;
  showTotals: boolean;
  columnColorFormatters: ColorFormatters;
  basicColorFormatters?: { [Key: string]: BasicColorFormatterType }[];
  basicColorColumnFormatters?: { [Key: string]: BasicColorFormatterType }[];
  formData: TableChartFormData;
}

export enum ColorSchemeEnum {
  'Green' = 'Green',
  'Red' = 'Red',
}

export interface SortState {
  colId: string;
  sort: 'asc' | 'desc' | null;
}

export interface CustomContext {
  initialSortState: SortState[];
  onColumnHeaderClicked: (args: { column: SortState }) => void;
}

export interface CustomHeaderParams extends IHeaderParams {
  context: CustomContext;
  column: Column;
  slice_id: number;
}

export interface UserProvidedColDef extends ColDef {
  isMain?: boolean;
  timeComparisonKey?: string;
}

export interface CustomColDef extends ColDef {
  context?: {
    isMetric?: boolean;
    isPercentMetric?: boolean;
    isNumeric?: boolean;
  };
}

export type TableDataColumnMeta = DataColumnMeta & {
  config?: TableColumnConfig;
};

export interface InputColumn {
  key: string;
  label: string;
  dataType: number;
  isNumeric: boolean;
  isMetric: boolean;
  isPercentMetric: boolean;
  config: Record<string, any>;
  formatter?: Function;
  originalLabel?: string;
  metricName?: string;
}

export type CellRendererProps = CustomCellRendererProps & {
  hasBasicColorFormatters: boolean | undefined;
  col: InputColumn;
  basicColorFormatters: {
    [Key: string]: BasicColorFormatterType;
  }[];
  valueRange: any;
  alignPositiveNegative: boolean;
  colorPositiveNegative: boolean;
  allowRenderHtml: boolean;
  columns: InputColumn[];
};

export type Dataset = {
  changed_by?: {
    first_name: string;
    last_name: string;
  };
  created_by?: {
    first_name: string;
    last_name: string;
  };
  changed_on_humanized: string;
  created_on_humanized: string;
  description: string;
  table_name: string;
  owners: {
    first_name: string;
    last_name: string;
  }[];
  columns?: Column[];
  metrics?: Metric[];
  verbose_map?: Record<string, string>;
};

export default {};

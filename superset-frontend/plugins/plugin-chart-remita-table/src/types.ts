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
  NumberFormatter,
  TimeFormatter,
  TimeGranularity,
  QueryFormMetric,
  ChartProps,
  // DataRecord,
  DataRecordValue,
  DataRecordFilters,
  GenericDataType,
  QueryMode,
  ChartDataResponseResult,
  // QueryFormData,
  SetDataMaskHook,
  ContextMenuFilters,
  CurrencyFormatter,
  Currency,
} from '@superset-ui/core';
import { ColorFormatters } from '@superset-ui/chart-controls';
import { QueryFormData, DataRecord } from '@superset-ui/core';

export type SelectionMode = 'multiple' | 'single';
export type VisibilityCondition = 'all' | 'selected' | 'unselected';
export type ActionStyle = 'default' | 'primary' | 'danger';

export interface BulkAction {
  key: string;
  label: string;
  type: 'dropdown' | 'button';
  style?: ActionStyle;
  boundToSelection: boolean;
  visibilityCondition: VisibilityCondition;
  showInSliceHeader: boolean;
  value: any;
  rowId: any
}


export interface RowAction {
  key: string;
  label: string;
  valueColumns?: string[];
  boundToSelection: boolean;
  visibilityCondition: VisibilityCondition;
}

export interface ActionConfig {
  enable_bulk_actions: boolean;
  bulk_action_id_column?: string;
  selection_mode: SelectionMode;
  split_actions: string; // key|label|boundToSelection|visibilityCondition
  non_split_actions: string; // key|label|style|boundToSelection|visibilityCondition
  row_actions: string; // key|label|valueColumns|boundToSelection|visibilityCondition
}

export interface BulkActionEvent {
  actionKey: string;
  selectedIds: string[];
}

export interface RowActionEvent {
  actionKey: string;
  rowId: string;
  values: Record<string, any>;
}

export interface TableActionsProps {
  selectedRows: Set<string>;
  actions: {
    split: BulkAction[];
    nonSplit: BulkAction[];
  };
  onActionClick: (action: string, selectedIds: string[]) => void;
}

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
};

export interface DataColumnMeta {
  // `key` is what is called `label` in the input props
  key: string;
  // `label` is verbose column name used for rendering
  label: string;
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
  enable_bulk_actions?: boolean;
  bulk_action_id_column?: string;
  selection_mode?: 'single' | 'multiple';
  split_actions?: string;
  non_split_actions?: string;
};

export interface TableChartProps extends ChartProps {
  ownCurrentState?: {
    pageSize?: number;
    currentPage?: number;
  };
  rawFormData: TableChartFormData;
  queriesData: ChartDataResponseResult[];
  hooks: {
    onBulkActionClick?: (actionKey: string, selectedIds: string[]) => void;
  };
  slice_id?: number
}

export type BasicColorFormatterType = {
  backgroundColor: string;
  arrowColor: string;
  mainArrow: string;
};

export interface TableChartTransformedProps<D extends DataRecord = DataRecord> {
  timeGrain?: TimeGranularity;
  height: number;
  width: number;
  rowCount?: number;
  serverPagination: boolean;
  serverPaginationData: { pageSize?: number; currentPage?: number };
  setDataMask: SetDataMaskHook;
  isRawRecords?: boolean;
  data: D[];
  totals?: D;
  columns: DataColumnMeta[];
  metrics?: (keyof D)[];
  percentMetrics?: (keyof D)[];
  pageSize?: number;
  showCellBars?: boolean;
  sortDesc?: boolean;
  includeSearch?: boolean;
  alignPositiveNegative?: boolean;
  colorPositiveNegative?: boolean;
  tableTimestampFormat?: string;
  // These are dashboard filters, don't be confused with in-chart search filter
  // enabled by `includeSearch`
  filters?: DataRecordFilters;
  emitCrossFilters?: boolean;
  onChangeFilter?: ChartProps['hooks']['onAddFilter'];
  columnColorFormatters?: ColorFormatters;
  allowRearrangeColumns?: boolean;
  allowRenderHtml?: boolean;
  onContextMenu?: (
    clientX: number,
    clientY: number,
    filters?: ContextMenuFilters,
  ) => void;
  isUsingTimeComparison?: boolean;
  basicColorFormatters?: { [Key: string]: BasicColorFormatterType }[];
  basicColorColumnFormatters?: { [Key: string]: BasicColorFormatterType }[];
  startDateOffset?: string;
  enable_bulk_actions?: boolean;
  bulk_action_id_column?: string;
  selection_mode?: 'single' | 'multiple';
  split_actions?: string;
  non_split_actions?: string;
  onBulkActionClick?: (actionKey: string, selectedIds: string[]) => void;
  slice_id?: number;
}

export enum ColorSchemeEnum {
  'Green' = 'Green',
  'Red' = 'Red',
}

export type ChartsState = { [key: string]: any };
/** Root state of redux */
export type RootState = {
  charts: ChartsState;
};
export default {};

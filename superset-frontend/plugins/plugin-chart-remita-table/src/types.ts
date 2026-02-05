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
  QueryMode,
  ChartDataResponseResult,
  // QueryFormData,
  SetDataMaskHook,
  ContextMenuFilters,
  CurrencyFormatter,
  Currency,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/api/core';
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
  icon?:
    | 'plus'
    | 'edit'
    | 'delete'
    | 'eye'
    | 'link'
    | 'check'
    | 'key'
    | 'tag'
    | 'more';
  tooltip?: string;
  boundToSelection: boolean;
  visibilityCondition: VisibilityCondition;
  showInSliceHeader: boolean;
  value: any;
  rowId: any;
  // Per-action override to open target in new tab
  openInNewTab?: boolean;
}


export interface RowAction {
  key: string;
  label: string;
  valueColumns?: string[];
  boundToSelection: boolean;
  visibilityCondition: VisibilityCondition;
  // Per-action override to open target in new tab (row actions)
  openInNewTab?: boolean;
}

export interface ActionConfig {
  enable_bulk_actions: boolean;
  row_id_column?: string;
  bulk_action_id_column?: string; // Deprecated: use row_id_column
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
  row_id_column?: string;
  bulk_action_id_column?: string; // Deprecated: use row_id_column
  selection_mode?: 'single' | 'multiple';
  split_actions?: string;
  non_split_actions?: string;
  // Backward compat: legacy flag (deprecated)
  enable_server_search_column_selector?: boolean;
  // New generic flag for displaying a search column selector
  show_search_column_select?: boolean;
  // Server search match mode (when server pagination + search column)
  server_search_match_mode?: 'prefix' | 'contains';
  // Consolidated actions configuration (UI grouping)
  actions_config?: any;
  // Description controls
  show_description?: boolean;
  description_markdown?: string;
  // JSON configuration manager (import/export/edit)
  json_config_manager?: string;
  // Include native filter values and params with action payloads
  include_native_filters?: boolean;
  // Alias for including dashboard filters at runtime (preferred naming)
  include_dashboard_filters?: boolean;
  // When auto-navigating to action URL, open in new tab
  open_action_url_in_new_tab?: boolean;
  // Humanize headers: replace '_' with space and Title Case when label is not customized
  humanize_headers?: boolean;
  // Interactivity feature toggles
  enable_column_visibility?: boolean;
  enable_column_resize?: boolean;
  enable_highlight_search?: boolean;
  enable_quick_filters?: boolean;
  enable_invert_selection?: boolean;
  enable_pin_columns?: boolean;
  // Advanced per-column filter panel (client-side)
  enable_advanced_column_filters?: boolean;
  // Right-click context menu for copy/export
  enable_context_menu_export?: boolean;
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
  slice_id?: string | number
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
  serverPaginationData: ServerPaginationData;
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
  // Native filters pass-through for actions
  includeNativeFilters?: boolean;
  nativeFilters?: Record<string, any>;
  nativeParams?: Record<string, any>;
  // Flattened query params derived from dashboard/native filters & extras
  dashboardQueryParams?: Record<string, any>;
  showSearchColumnSelector?: boolean;
  enable_bulk_actions?: boolean;
  selection_enabled?: boolean;
  row_id_column?: string;
  bulk_action_id_column?: string; // Deprecated: use row_id_column
  selection_mode?: 'single' | 'multiple';
  split_actions?: string;
  non_split_actions?: string;
  onBulkActionClick?: (actionKey: string, selectedIds: string[]) => void;
  slice_id?: string | number;
  // Description
  show_description?: boolean;
  description_markdown?: string;
  // Navigation behavior for action URL
  openInNewTab?: boolean;
  // Humanize headers and search dropdown labels
  humanizeHeaders?: boolean;
  // Interactivity feature toggles
  enableColumnVisibility?: boolean;
  enableColumnResize?: boolean;
  enableHighlightSearch?: boolean;
  enableQuickFilters?: boolean;
  enableInvertSelection?: boolean;
  enablePinColumns?: boolean;
  enableAdvancedColumnFilters?: boolean;
  enableContextMenuExport?: boolean;
  // Optional drill features (experimental; guarded for core compatibility)
  enableDrillFeatures?: boolean;
}

export enum ColorSchemeEnum {
  'Green' = 'Green',
  'Red' = 'Red',
}

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

export type ChartsState = { [key: string]: any };
/** Root state of redux */
export type RootState = {
  charts: ChartsState;
};
export default {};

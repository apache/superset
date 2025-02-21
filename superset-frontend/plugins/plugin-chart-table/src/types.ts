// DODO was here
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
  ContextMenuFilters,
  CurrencyFormatter,
  Currency,
} from '@superset-ui/core';
import { ColorFormatters } from '@superset-ui/chart-controls';

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

interface TableChartTransformedPropsDodoExtended {
  datasourceDescriptions: Record<string, string>; // DODO added 44728892
}
export interface TableChartTransformedProps<D extends DataRecord = DataRecord>
  extends TableChartTransformedPropsDodoExtended {
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
}

export enum ColorSchemeEnum {
  'Green' = 'Green',
  'Red' = 'Red',
}

export default {};

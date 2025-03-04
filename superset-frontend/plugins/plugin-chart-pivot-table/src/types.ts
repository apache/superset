// DODO was here
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
  Metric, // DODO added 44211769
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

export type PivotTableSharedColumnConfigProp = {
  d3NumberFormat: string; // DODO added 44211769
  aggregate: string; // DODO added 45525377
  hideValueInTotal: boolean; // DODO added 45525377
  pinColumn: boolean; // DODO added 45525377
};

interface PivotTableCustomizePropsDodoExtended {
  columnConfig: Record<string, PivotTableSharedColumnConfigProp>;
  datasourceMetrics: Metric[];
}
// DODO added 45525377
export type ColumnConfig = Record<
  string,
  Partial<PivotTableSharedColumnConfigProp>
>;

interface PivotTableCustomizePropsDodoExtended {
  datasourceDescriptions: Record<string, string>; // DODO added 44728892
  columnConfig: Record<string, PivotTableSharedColumnConfigProp>; // DODO added 45525377
  datasourceMetrics: Metric[]; // DODO added 45525377
}
interface PivotTableCustomizeProps
  extends PivotTableCustomizePropsDodoExtended {
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
}

export type PivotTableQueryFormData = QueryFormData &
  PivotTableStylesProps &
  PivotTableCustomizeProps;

// DODO added 45525377
type PivotTablePropsDodoExtended = {
  columnConfig: ColumnConfig;
  pinnedColumns: number[];
};
export type PivotTableProps = PivotTableStylesProps &
  PivotTableCustomizeProps & {
    data: DataRecord[];
  } & PivotTablePropsDodoExtended;

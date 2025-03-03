// DODO was here

import type { EChartsCoreOption } from 'echarts/core';
import {
  ChartDataResponseResult,
  ContextMenuFilters,
  DataRecordValue,
  QueryFormData,
  QueryFormMetric,
  TimeFormatter,
  ValueFormatter,
} from '@superset-ui/core';
import {
  ColorFormatters,
  ConditionalFormattingConfig, // DODO added 45525377
} from '@superset-ui/chart-controls';
import { BaseChartProps, Refs } from '../types';
// DODO added 45525377
import {
  AlignmentValue,
  ColorFormattersWithConditionalMessage,
  ValueToShowEnum,
} from '../DodoExtensions/BigNumber/types';

export interface BigNumberDatum {
  [key: string]: number | null;
}

// DODO added 45525377
type BigNumberTotalFormDataDodoExtended = {
  conditionalFormattingMessage: ConditionalFormattingConfig[];
  conditionalMessageFontSize: number;
  alignment: AlignmentValue;
};
export type BigNumberTotalFormData = QueryFormData & {
  metric?: QueryFormMetric;
  yAxisFormat?: string;
  forceTimestampFormatting?: boolean;
} & BigNumberTotalFormDataDodoExtended;

// DODO added 45525377
type BigNumberWithTrendlineFormDataDodoExtended = {
  valueToShow: ValueToShowEnum;
};
export type BigNumberWithTrendlineFormData = BigNumberTotalFormData & {
  colorPicker: {
    r: number;
    g: number;
    b: number;
  };
  compareLag?: string | number;
} & BigNumberWithTrendlineFormDataDodoExtended;

export interface BigNumberTotalChartDataResponseResult
  extends ChartDataResponseResult {
  data: BigNumberDatum[];
}

export type BigNumberTotalChartProps =
  BaseChartProps<BigNumberTotalFormData> & {
    formData: BigNumberTotalFormData;
    queriesData: BigNumberTotalChartDataResponseResult[];
  };

export type BigNumberWithTrendlineChartProps =
  BaseChartProps<BigNumberWithTrendlineFormData> & {
    formData: BigNumberWithTrendlineFormData;
  };

export type TimeSeriesDatum = [number, number | null];

// DODO added 45525377
type BigNumberVizPropsDodoExtended = {
  percentChange?: number;
  percentChangeFormatter?: ColorFormatters;
  conditionalMessageColorFormatters?: ColorFormattersWithConditionalMessage;
  conditionalMessageFontSize?: number;
  alignment?: AlignmentValue;
};
export type BigNumberVizProps = {
  className?: string;
  width: number;
  height: number;
  bigNumber?: DataRecordValue;
  bigNumberFallback?: TimeSeriesDatum;
  headerFormatter: ValueFormatter | TimeFormatter;
  formatTime?: TimeFormatter;
  headerFontSize: number;
  kickerFontSize?: number;
  subheader: string;
  subheaderFontSize: number;
  showTimestamp?: boolean;
  showTrendLine?: boolean;
  startYAxisAtZero?: boolean;
  timeRangeFixed?: boolean;
  timestamp?: DataRecordValue;
  trendLineData?: TimeSeriesDatum[];
  mainColor?: string;
  echartOptions?: EChartsCoreOption;
  onContextMenu?: (
    clientX: number,
    clientY: number,
    filters?: ContextMenuFilters,
  ) => void;
  xValueFormatter?: TimeFormatter;
  formData?: BigNumberWithTrendlineFormData;
  refs: Refs;
  colorThresholdFormatters?: ColorFormatters;
} & BigNumberVizPropsDodoExtended;

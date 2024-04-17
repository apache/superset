// DODO was here

import { EChartsCoreOption } from 'echarts';
import {
  ChartDataResponseResult,
  ContextMenuFilters,
  DataRecordValue,
  QueryFormData,
  QueryFormMetric,
  TimeFormatter,
  ValueFormatter,
} from '@superset-ui/core';
import { ColorFormatters } from '@superset-ui/chart-controls';
import { ColorFormattersWithConditionalMessage } from 'packages/superset-ui-chart-controls/src/DodoExtensions/types';
import { BaseChartProps, Refs } from '../types';
import { AlignmentValue } from '../DodoExtensions/BigNumber/types';

export interface BigNumberDatum {
  [key: string]: number | null;
}

export type BigNumberTotalFormData = QueryFormData & {
  metric?: QueryFormMetric;
  yAxisFormat?: string;
  forceTimestampFormatting?: boolean;
};

export type BigNumberWithTrendlineFormData = BigNumberTotalFormData & {
  colorPicker: {
    r: number;
    g: number;
    b: number;
  };
  compareLag?: string | number;
};

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

export type BigNumberVizProps = BigNumberVizPropsDodo & {
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
};

// DODO added
type BigNumberVizPropsDodo = {
  percentChange?: number;
  percentChangeFormatter?: ColorFormatters;
  conditionalMessageColorFormatters?: ColorFormattersWithConditionalMessage;
  conditionalMessageFontSize?: number;
  alignment?: AlignmentValue;
};

// DODO added
export enum COMPARATOR {
  NONE = 'None',
  GREATER_THAN = '>',
  LESS_THAN = '<',
  GREATER_OR_EQUAL = '≥',
  LESS_OR_EQUAL = '≤',
  EQUAL = '=',
  NOT_EQUAL = '≠',
  BETWEEN = '< x <',
  BETWEEN_OR_EQUAL = '≤ x ≤',
  BETWEEN_OR_LEFT_EQUAL = '≤ x <',
  BETWEEN_OR_RIGHT_EQUAL = '< x ≤',
}

// DODO added
export type ConditionalFormattingConfig = {
  operator?: COMPARATOR;
  targetValue?: number;
  targetValueLeft?: number | string;
  targetValueRight?: number | string;
  column?: string;
  colorScheme?: string;
  isFixedColor?: boolean;
};

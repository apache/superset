// DODO was here

import {
  ChartDataResponseResult,
  ChartProps,
  QueryFormData,
  QueryFormMetric,
} from '@superset-ui/core';

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

export type BigNumberTotalChartProps = ChartProps & {
  formData: BigNumberTotalFormData;
  queriesData: (ChartDataResponseResult & {
    data?: BigNumberDatum[];
  })[];
};

export type BigNumberWithTrendlineChartProps = BigNumberTotalChartProps & {
  formData: BigNumberWithTrendlineFormData;
};

export type TimeSeriesDatum = [number, number | null];

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

export type ConditionalFormattingConfig = {
  operator?: COMPARATOR;
  targetValue?: number;
  targetValueLeft?: number | string;
  targetValueRight?: number | string;
  column?: string;
  colorScheme?: string;
  isFixedColor?: boolean;
};

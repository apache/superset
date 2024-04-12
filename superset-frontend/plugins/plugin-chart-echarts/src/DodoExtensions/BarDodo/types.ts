// DODO added
import { EChartsOption } from 'echarts';
import {
  ChartDataResponseResult,
  ChartProps,
  DataRecordValue,
  QueryFormData,
  SetDataMaskHook,
} from '@superset-ui/core';
// import {
//   DEFAULT_LEGEND_FORM_DATA,
//   EchartsLegendFormData,
//   LegendOrientation,
//   LegendType,
// } from '../types';
import {
  DEFAULT_LEGEND_FORM_DATA,
  EchartsLegendFormData,
  LegendOrientation,
  LegendType,
} from '../../types';

export type EchartsBarFormData = QueryFormData &
  EchartsLegendFormData & {
    colorScheme?: string;
    currentOwnValue?: string[] | null;
    donut: boolean;
    defaultValue?: string[] | null;
    groupby: string[];
    innerRadius: number;
    labelLine: boolean;
    labelType: EchartsBarLabelType;
    labelsOutside: boolean;
    metric?: string;
    outerRadius: number;
    showLabels: boolean;
    numberFormat: string;
    dateFormat: string;
    showLabelsThreshold: number;
    emitFilter: boolean;
  };

export enum EchartsBarLabelType {
  Key = 'key',
  Value = 'value',
  Percent = 'percent',
  KeyValue = 'key_value',
  KeyPercent = 'key_percent',
  KeyValuePercent = 'key_value_percent',
}

export interface EchartsBarChartProps extends ChartProps {
  formData: EchartsBarFormData;
  queriesData: ChartDataResponseResult[];
}

// @ts-ignore
export const DEFAULT_FORM_DATA: EchartsBarFormData = {
  ...DEFAULT_LEGEND_FORM_DATA,
  donut: false,
  groupby: [],
  innerRadius: 30,
  labelLine: false,
  labelType: EchartsBarLabelType.Key,
  legendOrientation: LegendOrientation.Top,
  legendType: LegendType.Scroll,
  numberFormat: 'SMART_NUMBER',
  outerRadius: 70,
  showLabels: true,
  labelsOutside: true,
  showLabelsThreshold: 5,
  emitFilter: false,
  dateFormat: 'smart_date',
};

export interface BarChartTransformedProps {
  formData: EchartsBarFormData;
  height: number;
  width: number;
  echartOptions: EChartsOption;
  emitFilter: boolean;
  setDataMask: SetDataMaskHook;
  labelMap: Record<string, DataRecordValue[]>;
  groupby: string[];
  selectedValues: Record<number, string>;
}

import {
  ChartProps,
  ChartDataResponseResult,
  QueryFormColumn,
  QueryFormData,
} from '@superset-ui/core';
import { EchartsLegendFormData, EChartTransformedProps } from '../types';

export type EchartsBubbleFormData = QueryFormData &
  EchartsLegendFormData & {
    series?: string;
    entity: string;

    xAxisFormat: string;
    yAXisFormat: string;
    logXAxis: boolean;
    logYAxis: boolean;
    xAxisBounds: [number | undefined | null, number | undefined | null];
    yAxisBounds: [number | undefined | null, number | undefined | null];
    xAxisLabel?: string;
    colorScheme?: string;
    defaultValue?: string[] | null;
    groupby: QueryFormColumn[];
    metric?: string;
    numberFormat: string;
    dateFormat: string;
    emitFilter: boolean;
  };

export interface EchartsBubbleChartProps
  extends ChartProps<EchartsBubbleFormData> {
  formData: EchartsBubbleFormData;
  queriesData: ChartDataResponseResult[];
}

export type BubbleChartTransformedProps =
  EChartTransformedProps<EchartsBubbleFormData>;

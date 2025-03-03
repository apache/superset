// DODO was here
import {
  ChartProps,
  ChartDataResponseResult,
  QueryFormData,
  QueryFormMetric, // DODO added 45525377
} from '@superset-ui/core';
import {
  LegendFormData,
  BaseTransformedProps,
  CrossFilterTransformedProps,
} from '../types';

// DODO added 45525377
type EchartsBubbleFormDataDodoExtended = {
  xForceTimestampFormatting: boolean;
  yForceTimestampFormatting: boolean;
  xTimeFormat: string;
  yTimeFormat: string;
};
export type EchartsBubbleFormData = QueryFormData &
  LegendFormData & {
    series?: string;
    entity: string;
    xAxisFormat: string;
    yAxisFormat: string;
    logXAxis: boolean;
    logYAxis: boolean;
    xAxisBounds: [number | undefined | null, number | undefined | null];
    yAxisBounds: [number | undefined | null, number | undefined | null];
    xAxisLabel?: string;
    colorScheme?: string;
    defaultValue?: string[] | null;
    dateFormat: string;
    emitFilter: boolean;
    tooltipSizeFormat: string;
    x: QueryFormMetric;
    y: QueryFormMetric;
    size: QueryFormMetric;
  } & EchartsBubbleFormDataDodoExtended;

export interface EchartsBubbleChartProps
  extends ChartProps<EchartsBubbleFormData> {
  formData: EchartsBubbleFormData;
  queriesData: ChartDataResponseResult[];
}

export type BubbleChartTransformedProps =
  BaseTransformedProps<EchartsBubbleFormData> & CrossFilterTransformedProps;

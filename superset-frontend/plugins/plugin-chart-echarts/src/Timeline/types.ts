import {
  ChartDataResponseResult,
  ChartProps,
  QueryFormColumn,
  QueryFormData,
  QueryFormMetric,
} from '@superset-ui/core';
import {
  BaseTransformedProps,
  CrossFilterTransformedProps,
  LegendFormData,
} from '../types';

export type EchartsTimelineChartTransformedProps =
  BaseTransformedProps<EchartsTimelineFormData> & CrossFilterTransformedProps;

export type EchartsTimelineFormData = QueryFormData &
  LegendFormData & {
    viz_type: 'echarts_timeline';
    startTime: QueryFormColumn;
    endTime: QueryFormColumn;
    yAxis: QueryFormColumn;
    tooltipMetrics: QueryFormMetric[];
    tooltipColumns: QueryFormColumn[];
    series?: QueryFormColumn;
    xAxisTimeFormat?: string;
    tooltipTimeFormat?: string;
    tooltipValuesFormat?: string;
    colorScheme?: string;
    zoomable?: boolean;
    xAxisTitleMargin?: number;
    yAxisTitleMargin?: number;
    xAxisTimeBounds?: [string | null, string | null];
    subcategories?: boolean;
    showExtraControls?: boolean;
  };

export interface EchartsTimelineChartProps
  extends ChartProps<EchartsTimelineFormData> {
  formData: EchartsTimelineFormData;
  queriesData: ChartDataResponseResult[];
}

export interface Cartesian2dCoordSys {
  type: 'cartesian2d';
  x: number;
  y: number;
  width: number;
  height: number;
}

import { QueryFormColumn, QueryFormData } from '@superset-ui/core';
import {
  BaseChartProps,
  BaseTransformedProps,
  ContextMenuTransformedProps,
  CrossFilterTransformedProps,
  LegendFormData,
  LegendOrientation,
  LegendType,
} from '../types';
import { DEFAULT_LEGEND_FORM_DATA } from '../constants';

export type CustomChartFormData = QueryFormData &
  LegendFormData & {
    // Variables
    chartType: 'bar' | 'line' | 'pie'; // Chart type
    metrics: string[]; // Metrics to visualize
    groupBy: string[]; // Grouping columns
    colorScheme: string; // Color scheme
    showLegend: boolean; // Show legend toggle
    xAxisLabel: string; // Custom X-axis label
    yAxisLabel: string; // Custom Y-axis label
    showDataLabels: boolean; // Toggle for data labels
    isStacked: boolean; // Stacked chart option
  };

export enum CustomChartLabelType {
  // Enum Labels
  None = 'none',
  Inside = 'inside',
  Outside = 'outside',
  Top = 'top',
  Bottom = 'bottom',
  Left = 'left',
  Right = 'right',
};

export interface CustomChartProps
  extends BaseChartProps<CustomChartFormData> {
    formdata: CustomChartFormData
  }

// @ts-ignore
export const DEFAULT_FORM_DATA: CustomChartFormData = {
  ...DEFAULT_LEGEND_FORM_DATA,
  // Variables
  chartType: 'bar', // Default to bar chart
  metrics: [], // Start with no metrics
  groupBy: [], // Start with no grouping
  colorScheme: 'default', // Default color scheme
  showLegend: true, // Show legend by default
  xAxisLabel: '', // No default label
  yAxisLabel: '', // No default label
  showDataLabels: false, // Do not show data labels by default
  isStacked: false, // Not stacked by default
};

export type CustomChartTransformProps =
  BaseTransformedProps<CustomChartFormData> &
    ContextMenuTransformedProps &
    CrossFilterTransformedProps;
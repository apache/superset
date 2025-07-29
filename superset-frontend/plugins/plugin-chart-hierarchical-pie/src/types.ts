/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import {
  AdhocMetric, // Import the correct type for metrics
  ChartProps,
  DataRecord,
  QueryFormData,
} from '@superset-ui/core';

import type { RefObject } from 'react';
import type { ECharts } from 'echarts';

export enum LegendOrientation {
  Top = 'top',
  Bottom = 'bottom',
  Left = 'left',
  Right = 'right',
}

// Add this enum to src/types.ts
export enum EchartsPieLabelType {
  Key = 'key',
  Value = 'value',
  Percent = 'percent',
  KeyValue = 'key_value',
  KeyPercent = 'key_percent',
  ValuePercent = 'value_percent',
  KeyValuePercent = 'key_value_percent',
  Template = 'template',
}

// In src/types.ts
export interface DrilldownPieFormData extends QueryFormData {
  groupby: string[];
  metric?: AdhocMetric | string;
  colorScheme: string;
  // All the other controls from the native pie chart
  donut?: boolean;
  labelsOutside?: boolean;
  labelLine?: boolean;
  // labelType?: EchartsPieLabelType;
  label_template?: string;
  innerRadius?: number;
  outerRadius?: number;
  showLegend?: boolean;
  legendType?: string;
  legendOrientation?: string;
  // ... and any others
  threshold_for_other?: number;
  label_type?: EchartsPieLabelType; // Assuming label_type is also needed
}

// Add this to src/types.ts
export interface PieChartDataItem {
  name: string;
  value: number;
  itemStyle?: {
    color?: string;
    opacity?: number;
  };
  isOther?: boolean;
}

// This is the shape of our custom drilldown object
export interface DrilldownData {
  sourceData: DataRecord[];
  hierarchy: string[];
  metric: string;
}

// All other types below are for the files we haven't adapted yet.
// They are based on the native ECharts Pie plugin.
export interface EchartsPieChartProps extends ChartProps {
  formData: DrilldownPieFormData;
  // We will define this properly in the next steps
  echartOptions: any;
}

// export type PieChartTransformedProps = EchartsPieChartProps;
// This is the final props object our component will receive.
// It inherits all base ChartProps and adds our custom properties.
export type PieChartTransformedProps = ChartProps<DrilldownPieFormData> & {
  echartOptions: any;
  // This is our custom addition
  drilldownData: DrilldownData;
  refs?: RefObject<ECharts>;
};
// // This provides default values for the controls in the UI.
// export const DEFAULT_FORM_DATA: DrilldownPieFormData = {
//   groupby: [],
//   // CORRECTED: The correct default for an unselected metric is undefined.
//   metric: undefined,
//   colorScheme: 'supersetColors',
//   datasource: '',
//   viz_type: 'hierarchical_pie',
// };

// Default values for the controls
export const DEFAULT_FORM_DATA: DrilldownPieFormData = {
  groupby: [],
  metric: undefined,
  colorScheme: 'supersetColors',
  datasource: '',
  viz_type: 'hierarchical_pie',
  donut: true,
  showLegend: true,
  labelType: EchartsPieLabelType.Key,
  labelsOutside: true,
  innerRadius: 30,
  outerRadius: 70,
};

export enum ForecastSeriesEnum {
  Observation = '__observation',
  ForecastTrend = '__forecast_trend',
  ForecastLower = '__forecast_lower',
  ForecastUpper = '__forecast_upper',
}

export interface ForecastSeriesContext {
  name: string;
  type: ForecastSeriesEnum;
  value: number[];
}

export interface ForecastValue {
  observation?: number;
  forecastTrend?: number;
  forecastLower?: number;
  forecastUpper?: number;
  marker?: string;
}

// Chart series type (line, bar, etc.)
export const enum EchartsTimeseriesSeriesType {
  Line = 'line',
  Bar = 'bar',
  Scatter = 'scatter',
  Smooth = 'smooth',
  Step = 'step',
}

// Legend types used in ECharts charts
export type LegendType = 'scroll' | 'plain';

// Stack type for stacking series
export type StackType = 'stack' | 'expand' | 'none';

export interface Refs {
  divRef: React.RefObject<HTMLDivElement>;
  echartRef: { current: echarts.ECharts | null };
}

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import type { OptionName } from 'echarts/types/src/util/types';
import {
  AnnotationLayer,
  AxisType,
  ContributionType,
  QueryFormData,
  QueryFormMetric,
  TimeFormatter,
  TimeGranularity,
} from '@superset-ui/core';
import {
  BaseChartProps,
  BaseTransformedProps,
  ContextMenuTransformedProps,
  CrossFilterTransformedProps,
  LegendFormData,
  StackType,
  TitleFormData,
} from '../types';

export enum OrientationType {
  Vertical = 'vertical',
  Horizontal = 'horizontal',
}

export enum EchartsTimeseriesSeriesType {
  Line = 'line',
  Scatter = 'scatter',
  Smooth = 'smooth',
  Bar = 'bar',
  Start = 'start',
  Middle = 'middle',
  End = 'end',
}

export type EchartsTimeseriesFormData = QueryFormData & {
  annotationLayers: AnnotationLayer[];
  area: boolean;
  colorScheme?: string;
  contributionMode?: ContributionType;
  forecastEnabled: boolean;
  forecastPeriods: number;
  forecastInterval: number;
  forecastSeasonalityDaily: null;
  forecastSeasonalityWeekly: null;
  forecastSeasonalityYearly: null;
  logAxis: boolean;
  markerEnabled: boolean;
  markerSize: number;
  metrics: QueryFormMetric[];
  minorSplitLine: boolean;
  minorTicks: boolean;
  opacity: number;
  orderDesc: boolean;
  rowLimit: number;
  seriesType: EchartsTimeseriesSeriesType;
  stack: StackType;
  timeCompare?: string[];
  tooltipTimeFormat?: string;
  truncateXAxis: boolean;
  truncateYAxis: boolean;
  yAxisFormat?: string;
  xAxisForceCategorical?: boolean;
  xAxisTimeFormat?: string;
  timeGrainSqla?: TimeGranularity;
  xAxisBounds: [number | undefined | null, number | undefined | null];
  yAxisBounds: [number | undefined | null, number | undefined | null];
  zoomable: boolean;
  richTooltip: boolean;
  xAxisLabelRotation: number;
  showValue: boolean;
  onlyTotal: boolean;
  showExtraControls: boolean;
  percentageThreshold: number;
  orientation?: OrientationType;
} & LegendFormData &
  TitleFormData;

export interface EchartsTimeseriesChartProps
  extends BaseChartProps<EchartsTimeseriesFormData> {
  formData: EchartsTimeseriesFormData;
}

export type TimeseriesChartTransformedProps =
  BaseTransformedProps<EchartsTimeseriesFormData> &
    ContextMenuTransformedProps &
    CrossFilterTransformedProps & {
      legendData?: OptionName[];
      xValueFormatter: TimeFormatter | StringConstructor;
      xAxis: {
        label: string;
        type: AxisType;
      };
      onFocusedSeries: (series: string | null) => void;
    };

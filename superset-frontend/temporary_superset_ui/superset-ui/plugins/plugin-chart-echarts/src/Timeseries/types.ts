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
import {
  AnnotationLayer,
  ChartDataResponseResult,
  ChartProps,
  DataRecordValue,
  QueryFormData,
  SetDataMaskHook,
  TimeGranularity,
} from '@superset-ui/core';
import { EChartsOption } from 'echarts';
import { DEFAULT_LEGEND_FORM_DATA, EchartsLegendFormData } from '../types';

export enum EchartsTimeseriesContributionType {
  Row = 'row',
  Column = 'column',
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
  contributionMode?: EchartsTimeseriesContributionType;
  forecastEnabled: boolean;
  forecastPeriods: number;
  forecastInterval: number;
  forecastSeasonalityDaily: null;
  forecastSeasonalityWeekly: null;
  forecastSeasonalityYearly: null;
  logAxis: boolean;
  markerEnabled: boolean;
  markerSize: number;
  minorSplitLine: boolean;
  opacity: number;
  orderDesc: boolean;
  rowLimit: number;
  seriesType: EchartsTimeseriesSeriesType;
  stack: boolean;
  tooltipTimeFormat?: string;
  truncateYAxis: boolean;
  yAxisFormat?: string;
  yAxisTitle: string;
  xAxisShowMinLabel?: boolean;
  xAxisShowMaxLabel?: boolean;
  xAxisTimeFormat?: string;
  timeGrainSqla?: TimeGranularity;
  yAxisBounds: [number | undefined | null, number | undefined | null];
  zoomable: boolean;
  richTooltip: boolean;
  xAxisLabelRotation: number;
  emitFilter: boolean;
  groupby: string[];
} & EchartsLegendFormData;

// @ts-ignore
export const DEFAULT_FORM_DATA: EchartsTimeseriesFormData = {
  ...DEFAULT_LEGEND_FORM_DATA,
  annotationLayers: [],
  area: false,
  forecastEnabled: false,
  forecastInterval: 0.8,
  forecastPeriods: 10,
  forecastSeasonalityDaily: null,
  forecastSeasonalityWeekly: null,
  forecastSeasonalityYearly: null,
  logAxis: false,
  markerEnabled: false,
  markerSize: 6,
  minorSplitLine: false,
  opacity: 0.2,
  orderDesc: true,
  rowLimit: 10000,
  seriesType: EchartsTimeseriesSeriesType.Line,
  stack: false,
  tooltipTimeFormat: 'smart_date',
  truncateYAxis: true,
  yAxisBounds: [null, null],
  zoomable: false,
  richTooltip: true,
  xAxisLabelRotation: 0,
  emitFilter: false,
  groupby: [],
  yAxisTitle: '',
};

export interface EchartsTimeseriesChartProps extends ChartProps {
  formData: EchartsTimeseriesFormData;
  queriesData: ChartDataResponseResult[];
}

export interface TimeseriesChartTransformedProps {
  formData: EchartsTimeseriesFormData;
  height: number;
  width: number;
  echartOptions: EChartsOption;
  emitFilter: boolean;
  setDataMask: SetDataMaskHook;
  labelMap: Record<string, DataRecordValue[]>;
  groupby: string[];
}

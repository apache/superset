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
  TimeGranularity,
  QueryFormData,
  QueryFormColumn,
  ContributionType,
  TimeFormatter,
  AxisType,
} from '@superset-ui/core';
import {
  BaseChartProps,
  BaseTransformedProps,
  ContextMenuTransformedProps,
  CrossFilterTransformedProps,
  EchartsTimeseriesSeriesType,
  LegendFormData,
  StackType,
  TitleFormData,
} from '../types';

export type EchartsMixedTimeseriesFormData = QueryFormData & {
  annotationLayers: AnnotationLayer[];
  // shared properties
  minorSplitLine: boolean;
  logAxis: boolean;
  logAxisSecondary: boolean;
  yAxisFormat?: string;
  yAxisFormatSecondary?: string;
  yAxisTitleSecondary: string;
  yAxisBounds: [number | undefined | null, number | undefined | null];
  yAxisBoundsSecondary: [number | undefined | null, number | undefined | null];
  xAxisTimeFormat?: string;
  truncateYAxis: boolean;
  truncateYAxisSecondary: boolean;
  timeGrainSqla?: TimeGranularity;
  tooltipTimeFormat?: string;
  zoomable: boolean;
  richTooltip: boolean;
  xAxisLabelRotation: number;
  colorScheme?: string;
  // types specific to Query A and Query B
  area: boolean;
  areaB: boolean;
  contributionMode?: ContributionType;
  contributionModeB?: ContributionType;
  markerEnabled: boolean;
  markerEnabledB: boolean;
  markerSize: number;
  markerSizeB: number;
  opacity: number;
  opacityB: number;
  orderDesc: boolean;
  orderDescB: boolean;
  rowLimit: number;
  rowLimitB: number;
  seriesType: EchartsTimeseriesSeriesType;
  seriesTypeB: EchartsTimeseriesSeriesType;
  showValue: boolean;
  showValueB: boolean;
  stack: StackType;
  stackB: StackType;
  yAxisIndex?: number;
  yAxisIndexB?: number;
  groupby: QueryFormColumn[];
  groupbyB: QueryFormColumn[];
} & LegendFormData &
  TitleFormData;

export interface EchartsMixedTimeseriesProps
  extends BaseChartProps<EchartsMixedTimeseriesFormData> {
  formData: EchartsMixedTimeseriesFormData;
}

export type EchartsMixedTimeseriesChartTransformedProps =
  BaseTransformedProps<EchartsMixedTimeseriesFormData> &
    ContextMenuTransformedProps &
    CrossFilterTransformedProps & {
      groupbyB: QueryFormColumn[];
      labelMapB: Record<string, string[]>;
      seriesBreakdown: number;
      xValueFormatter: TimeFormatter | StringConstructor;
      xAxis: {
        label: string;
        type: AxisType;
      };
      onFocusedSeries: (series: string | null) => void;
    };

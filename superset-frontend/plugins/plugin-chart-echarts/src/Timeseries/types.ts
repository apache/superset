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
  TooltipTruncationMode,
} from '@superset-ui/core';
import {
  BaseChartProps,
  BaseTransformedProps,
  ContextMenuTransformedProps,
  CrossFilterTransformedProps,
  LabelPositionEnum,
  LegendFormData,
  LegendOrientation,
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

export enum BarValueLabelPosition {
  Auto = 'auto',
  InsideEnd = 'insideEnd',
  OutsideEnd = 'outsideEnd',
  InsideCenter = 'insideCenter',
  InsideBase = 'insideBase',
}

export type EchartsTimeseriesFormData = QueryFormData & {
  annotationLayers: AnnotationLayer[];
  area: boolean;
  colorScheme?: string;
  timeShiftColor?: boolean;
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
  maxMarkerSize?: number;
  minMarkerSize?: number;
  metrics: QueryFormMetric[];
  minorSplitLine: boolean;
  minorTicks: boolean;
  gridlines: boolean;
  axisTicks: boolean;
  opacity: number;
  orderDesc: boolean;
  rowLimit: number;
  seriesType: EchartsTimeseriesSeriesType;
  size?: QueryFormMetric;
  stack: StackType;
  stackDimension: string;
  timeCompare?: string[];
  tooltipTimeFormat?: string;
  showTooltipTotal?: boolean;
  showTooltipPercentage?: boolean;
  tooltipTruncation?: TooltipTruncationMode;
  truncateXAxis: boolean;
  truncateYAxis: boolean;
  yAxisFormat?: string;
  xAxisForceCategorical?: boolean;
  xAxisTimeFormat?: string;
  xAxisNumberFormat?: string;
  timeGrainSqla?: TimeGranularity;
  forceMaxInterval?: boolean;
  xAxisBounds: [number | undefined | null, number | undefined | null];
  yAxisBounds: [number | undefined | null, number | undefined | null];
  zoomable: boolean;
  richTooltip: boolean;
  xAxisLabelRotation: number;
  xAxisLabelInterval: number | string;
  showValue: boolean;
  valueLabelPosition: BarValueLabelPosition;
  /**
   * Where the data label sits relative to its data point, applied when
   * `showValue` is on.
   *
   * `'auto'` keeps the orientation-aware default the chart used before this
   * control existed: `Right` for a horizontal chart, `Top` otherwise. It is
   * also the value every chart saved before then resolves to, so the default
   * must stay `'auto'` for those to keep rendering as they did.
   */
  labelPosition?: LabelPositionEnum | 'auto';
  onlyTotal: boolean;
  showExtraControls: boolean;
  percentageThreshold: number;
  colorByPrimaryAxis?: boolean;
  orientation?: OrientationType;
} & LegendFormData &
  TitleFormData;

export interface EchartsTimeseriesChartProps extends BaseChartProps<EchartsTimeseriesFormData> {
  formData: EchartsTimeseriesFormData;
}

export type TimeseriesLegendItem = {
  color: string;
  interactive: boolean;
  name: string;
  selected: boolean;
};

export type TimeseriesCustomLegend = {
  grid: {
    bottom: number | string;
    top: number | string;
  };
  items: TimeseriesLegendItem[];
  orientation: LegendOrientation.Top | LegendOrientation.Bottom;
  showSelectors: boolean;
};

export type TimeseriesChartTransformedProps =
  BaseTransformedProps<EchartsTimeseriesFormData> &
    ContextMenuTransformedProps &
    CrossFilterTransformedProps & {
      customLegend?: TimeseriesCustomLegend;
      legendData?: OptionName[];
      isRefreshing?: boolean;
      xValueFormatter: TimeFormatter | StringConstructor;
      xAxis: {
        label: string;
        type: AxisType;
      };
      resolvedTimeGrain?: TimeGranularity;
      onFocusedSeries: (series: string | null) => void;
    };

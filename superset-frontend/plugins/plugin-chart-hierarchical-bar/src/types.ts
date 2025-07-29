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
import { ChartProps, QueryFormData } from '@superset-ui/core';
import {
  LegendFormData,
  LegendOrientation,
  TitleFormData,
} from '@superset-ui/plugin-chart-echarts';

import type { TooltipMarker } from 'echarts/types/src/util/format';
import { LegendType } from '@superset-ui/plugin-chart-echarts';

// --- Custom LegendType for our plugin
// export type LegendType = 'scroll' | 'plain';

export type ForecastTooltipData = {
  marker: TooltipMarker | string;
  observation?: number;
  forecastTrend?: number;
  forecastLower?: number;
  forecastUpper?: number;
};

export enum EchartsBarLabelType {
  Key,
  Value,
  Percent,
  KeyValue,
  KeyPercent,
  ValuePercent,
  KeyValuePercent,
}

export interface DrilldownBarFormData
  extends Omit<LegendFormData, 'legendType'>,
    TitleFormData,
    QueryFormData {
  colorScheme?: string;
  stack: boolean;
  area: boolean;
  showExtraControls: boolean;
  labelType: EchartsBarLabelType;
  labelRotation: number;
  showLabels: boolean;
  legendState: 'on' | 'off';
  legendType?: LegendType; // explicitly override here
  metric?: string;
}

export const DEFAULT_FORM_DATA: Partial<DrilldownBarFormData> = {
  datasource: '',
  viz_type: 'hierarchical_bar',
  colorScheme: 'supersetColors',
  stack: false,
  area: false,
  showExtraControls: false,
  labelType: EchartsBarLabelType.Value,
  labelRotation: 0,
  showLabels: true,
  legendState: 'on',
  legendOrientation: LegendOrientation.Top,
  legendType: 'scroll' as LegendType,
  groupby: [],
  metric: undefined,
  showLegend: true,
  legendMargin: null,
  xAxisTitle: '',
  xAxisTitleMargin: 0,
  yAxisTitle: '',
  yAxisTitleMargin: 0,
  yAxisTitlePosition: 'left',
};

export interface BarChartTransformedProps
  extends ChartProps<DrilldownBarFormData> {
  echartOptions: any;
  drilldownData: {
    sourceData: any[];
    hierarchy: string[];
    metric: string;
  };
  refs?: {
    echartRef?: { current?: any };
  };
}

export interface BarChartDataItem {
  name: string;
  value: number | null;
  itemStyle: {
    color: string;
  };
}

// Re-export for convenience elsewhere
export {
  LegendFormData,
  LegendOrientation,
  TitleFormData,
} from '@superset-ui/plugin-chart-echarts';

export enum ForecastSeriesEnum {
  Observation = 'observation',
  ForecastTrend = 'forecastTrend',
  ForecastUpper = 'forecastUpper',
  ForecastLower = 'forecastLower',
}

export type ForecastValue = [number | string, number | null];

export type ForecastSeriesContext = {
  name: string;
  type: ForecastSeriesEnum;
  value: ForecastValue[];
};

export type Refs = {
  divRef?: React.RefObject<HTMLDivElement>;
  echartRef?: React.RefObject<any>;
};

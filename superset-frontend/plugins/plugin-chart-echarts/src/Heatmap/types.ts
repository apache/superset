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
  Currency,
  QueryFormColumn,
  QueryFormData,
  QueryFormMetric,
  RgbaColor,
} from '@superset-ui/core';
import { BaseChartProps, BaseTransformedProps } from '../types';

export interface HeatmapFormData extends QueryFormData {
  bottomMargin: string;
  currencyFormat?: Currency;
  leftMargin: string;
  legendType: 'continuous' | 'piecewise';
  linearColorScheme?: string;
  metric: QueryFormMetric;
  normalizeAcross: 'heatmap' | 'x' | 'y';
  normalized?: boolean;
  borderColor: RgbaColor;
  borderWidth: number;
  showLegend?: boolean;
  showPercentage?: boolean;
  showValues?: boolean;
  sortXAxis?: string;
  sortYAxis?: string;
  timeFormat?: string;
  xAxis: QueryFormColumn;
  xscaleInterval: number;
  valueBounds: [number | undefined | null, number | undefined | null];
  yAxisFormat?: string;
  yscaleInterval: number;
}

export interface HeatmapChartProps extends BaseChartProps<HeatmapFormData> {
  formData: HeatmapFormData;
}

export type HeatmapTransformedProps = BaseTransformedProps<HeatmapFormData>;

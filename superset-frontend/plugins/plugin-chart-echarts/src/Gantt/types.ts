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

export type EchartsGanttChartTransformedProps =
  BaseTransformedProps<EchartsGanttFormData> & CrossFilterTransformedProps;

export type EchartsGanttFormData = QueryFormData &
  LegendFormData & {
    viz_type: 'gantt_chart';
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
    xAxisTitle?: string;
    xAxisTitleMargin?: number;
    yAxisTitle?: string;
    yAxisTitleMargin?: number;
    yAxisTitlePosition?: string;
    xAxisTimeBounds?: [string | null, string | null];
    subcategories?: boolean;
    showExtraControls?: boolean;
  };

export interface EchartsGanttChartProps
  extends ChartProps<EchartsGanttFormData> {
  formData: EchartsGanttFormData;
  queriesData: ChartDataResponseResult[];
}

export interface Cartesian2dCoordSys {
  type: 'cartesian2d';
  x: number;
  y: number;
  width: number;
  height: number;
}

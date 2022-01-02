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
  DataRecordValue,
  QueryFormData,
  QueryFormMetric,
  SetDataMaskHook,
} from '@superset-ui/core';
import { EChartsOption } from 'echarts';
import { EchartsLegendFormData } from '../types';

export type WaterfallFormXTicksLayout =
  | '45°'
  | '90°'
  | 'auto'
  | 'flat'
  | 'staggered';

export type EchartsWaterfallFormData = QueryFormData &
  EchartsLegendFormData & {
    metric: QueryFormMetric;
    yAxisLabel: string;
    xAxisLabel: string;
    yAxisFormat: string;
    xTicksLayout?: WaterfallFormXTicksLayout;
    series: string;
    columns?: string;
  };

export const DEFAULT_FORM_DATA: Partial<EchartsWaterfallFormData> = {
  showLegend: true,
};

export interface EchartsWaterfallChartProps extends ChartProps {
  formData: EchartsWaterfallFormData;
  queriesData: ChartDataResponseResult[];
}

export interface WaterfallChartTransformedProps {
  formData: EchartsWaterfallFormData;
  height: number;
  width: number;
  echartOptions: EChartsOption;
  emitFilter: boolean;
  setDataMask: SetDataMaskHook;
  labelMap: Record<string, DataRecordValue[]>;
  groupby: string[];
  selectedValues: Record<number, string>;
}

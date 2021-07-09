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
import { ChartDataResponseResult, ChartProps, QueryFormData } from '@superset-ui/core';
import { DEFAULT_LEGEND_FORM_DATA, EChartTransformedProps } from '../types';

export type AxisTickLineStyle = {
  width: number;
  color: string;
};

export type EchartsGaugeFormData = QueryFormData & {
  colorScheme?: string;
  groupby: string[];
  metric?: object;
  rowLimit: number;
  minVal: number;
  maxVal: number;
  fontSize: number;
  numberFormat: string;
  animation: boolean;
  showProgress: boolean;
  overlap: boolean;
  roundCap: boolean;
  showAxisTick: boolean;
  showSplitLine: boolean;
  splitNumber: number;
  startAngle: number;
  endAngle: number;
  showPointer: boolean;
  intervals: string;
  intervalColorIndices: string;
  valueFormatter: string;
  emitFilter: boolean;
};

export const DEFAULT_FORM_DATA: Partial<EchartsGaugeFormData> = {
  ...DEFAULT_LEGEND_FORM_DATA,
  groupby: [],
  rowLimit: 10,
  minVal: 0,
  maxVal: 100,
  fontSize: 15,
  numberFormat: 'SMART_NUMBER',
  animation: true,
  showProgress: true,
  overlap: true,
  roundCap: false,
  showAxisTick: false,
  showSplitLine: false,
  splitNumber: 10,
  startAngle: 225,
  endAngle: -45,
  showPointer: true,
  intervals: '',
  intervalColorIndices: '',
  valueFormatter: '{value}',
  emitFilter: false,
};

export interface EchartsGaugeChartProps extends ChartProps {
  formData: EchartsGaugeFormData;
  queriesData: ChartDataResponseResult[];
}

export type GaugeChartTransformedProps = EChartTransformedProps<EchartsGaugeFormData>;

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
  QueryFormData,
} from '@superset-ui/core';
import {
  EchartsLegendFormData,
  EChartTransformedProps,
  LegendOrientation,
  LegendType,
} from '../types';
import { DEFAULT_LEGEND_FORM_DATA } from '../constants';

export type EchartsFunnelFormData = QueryFormData &
  EchartsLegendFormData & {
    colorScheme?: string;
    groupby: QueryFormData[];
    labelLine: boolean;
    labelType: EchartsFunnelLabelTypeType;
    metric?: string;
    showLabels: boolean;
    numberFormat: string;
    gap: number;
    sort: 'descending' | 'ascending' | 'none' | undefined;
    orient: 'vertical' | 'horizontal' | undefined;
    emitFilter: boolean;
  };

export enum EchartsFunnelLabelTypeType {
  Key,
  Value,
  Percent,
  KeyValue,
  KeyPercent,
  KeyValuePercent,
}

export interface EchartsFunnelChartProps
  extends ChartProps<EchartsFunnelFormData> {
  formData: EchartsFunnelFormData;
  queriesData: ChartDataResponseResult[];
}

// @ts-ignore
export const DEFAULT_FORM_DATA: EchartsFunnelFormData = {
  ...DEFAULT_LEGEND_FORM_DATA,
  groupby: [],
  labelLine: false,
  labelType: EchartsFunnelLabelTypeType.Key,
  legendOrientation: LegendOrientation.Top,
  legendType: LegendType.Scroll,
  numberFormat: 'SMART_NUMBER',
  showLabels: true,
  sort: 'descending',
  orient: 'vertical',
  gap: 0,
  emitFilter: false,
};

export type FunnelChartTransformedProps =
  EChartTransformedProps<EchartsFunnelFormData>;

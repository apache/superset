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
  QueryFormColumn,
  QueryFormData,
  QueryFormMetric,
} from '@superset-ui/core';
import {
  BaseChartProps,
  BaseTransformedProps,
  ContextMenuTransformedProps,
  CrossFilterTransformedProps,
  LegendFormData,
  LabelPositionEnum,
  LegendOrientation,
  LegendType,
} from '../types';
import { DEFAULT_LEGEND_FORM_DATA } from '../constants';

type RadarColumnConfig = Record<string, { radarMetricMaxValue?: number }>;

export type EchartsRadarFormData = QueryFormData &
  LegendFormData & {
    colorScheme?: string;
    columnConfig?: RadarColumnConfig;
    currentOwnValue?: string[] | null;
    currentValue?: string[] | null;
    defaultValue?: string[] | null;
    groupby: QueryFormColumn[];
    labelType: EchartsRadarLabelType;
    labelPosition: LabelPositionEnum;
    metrics: QueryFormMetric[];
    showLabels: boolean;
    isCircle: boolean;
    numberFormat: string;
    dateFormat: string;
  };

export enum EchartsRadarLabelType {
  Value = 'value',
  KeyValue = 'key_value',
}

export interface EchartsRadarChartProps
  extends BaseChartProps<EchartsRadarFormData> {
  formData: EchartsRadarFormData;
}

// @ts-ignore
export const DEFAULT_FORM_DATA: EchartsRadarFormData = {
  ...DEFAULT_LEGEND_FORM_DATA,
  groupby: [],
  labelType: EchartsRadarLabelType.Value,
  labelPosition: LabelPositionEnum.Top,
  legendOrientation: LegendOrientation.Top,
  legendType: LegendType.Scroll,
  numberFormat: 'SMART_NUMBER',
  showLabels: true,
  dateFormat: 'smart_date',
  isCircle: false,
};

export type RadarChartTransformedProps =
  BaseTransformedProps<EchartsRadarFormData> &
    ContextMenuTransformedProps &
    CrossFilterTransformedProps;

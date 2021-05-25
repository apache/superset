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
import { CallbackDataParams } from 'echarts/types/src/util/types';
import { LabelPositionEnum } from '../types';

export type EchartsTreemapFormData = QueryFormData & {
  colorScheme?: string;
  groupby: string[];
  metric?: QueryFormMetric;
  labelType: EchartsTreemapLabelType;
  labelPosition: LabelPositionEnum;
  showLabels: boolean;
  showUpperLabels: boolean;
  numberFormat: string;
  dateFormat: string;
  dashboardId?: number;
  emitFilter: boolean;
};

export enum EchartsTreemapLabelType {
  Key = 'key',
  Value = 'value',
  KeyValue = 'key_value',
}

export interface EchartsTreemapChartProps extends ChartProps {
  formData: EchartsTreemapFormData;
  queriesData: ChartDataResponseResult[];
}

export const DEFAULT_FORM_DATA: Partial<EchartsTreemapFormData> = {
  groupby: [],
  labelType: EchartsTreemapLabelType.KeyValue,
  labelPosition: LabelPositionEnum.InsideTopLeft,
  numberFormat: 'SMART_NUMBER',
  showLabels: true,
  showUpperLabels: true,
  dateFormat: 'smart_date',
  emitFilter: false,
};

export interface TreePathInfo {
  name: string;
  dataIndex: number;
  value: number | number[];
}
export interface TreemapSeriesCallbackDataParams extends CallbackDataParams {
  treePathInfo?: TreePathInfo[];
}

export interface TreemapTransformedProps {
  formData: EchartsTreemapFormData;
  height: number;
  width: number;
  echartOptions: EChartsOption;
  emitFilter: boolean;
  setDataMask: SetDataMaskHook;
  labelMap: Record<string, DataRecordValue[]>;
  groupby: string[];
  selectedValues: Record<number, string>;
}

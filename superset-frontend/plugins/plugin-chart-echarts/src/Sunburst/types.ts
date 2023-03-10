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
  QueryFormColumn,
  QueryFormData,
  QueryFormMetric,
} from '@superset-ui/core';
import { SunburstSeriesNodeItemOption } from 'echarts/types/src/chart/sunburst/SunburstSeries';
import {
  BaseTransformedProps,
  ContextMenuTransformedProps,
  CrossFilterTransformedProps,
} from '../types';

export type EchartsSunburstFormData = QueryFormData & {
  groupby: QueryFormColumn[];
  metric: QueryFormMetric;
  secondaryMetric?: QueryFormMetric;
  colorScheme?: string;
  linearColorScheme?: string;
};

export enum EchartsSunburstLabelType {
  Key = 'key',
  Value = 'value',
  KeyValue = 'key_value',
}

export const DEFAULT_FORM_DATA: Partial<EchartsSunburstFormData> = {
  groupby: [],
  numberFormat: 'SMART_NUMBER',
  labelType: EchartsSunburstLabelType.Key,
  showLabels: false,
  dateFormat: 'smart_date',
};

export interface EchartsSunburstChartProps
  extends ChartProps<EchartsSunburstFormData> {
  formData: EchartsSunburstFormData;
  queriesData: ChartDataResponseResult[];
}

export type SunburstTransformedProps =
  BaseTransformedProps<EchartsSunburstFormData> &
    ContextMenuTransformedProps &
    CrossFilterTransformedProps;

export type NodeItemOption = SunburstSeriesNodeItemOption & {
  records: DataRecordValue[];
  secondaryValue: number;
};

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
import { QueryFormData, QueryFormMetric } from '@superset-ui/core';
import {
  BaseChartProps,
  BaseTransformedProps,
  CrossFilterTransformedProps,
} from '../types';

export type EchartsTimePivotFormData = QueryFormData & {
  metric?: QueryFormMetric;
  /** pandas-style period offset, e.g. W-MON, D, AS */
  freq?: string;
  colorPicker?: { r: number; g: number; b: number; a: number };
  showLegend?: boolean;
  lineInterpolation?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  yAxisFormat?: string;
  yLogScale?: boolean;
  yAxisBounds?: [number | null, number | null];
};

export interface EchartsTimePivotChartProps extends BaseChartProps<EchartsTimePivotFormData> {
  formData: EchartsTimePivotFormData;
}

export type TimePivotChartTransformedProps =
  BaseTransformedProps<EchartsTimePivotFormData> & CrossFilterTransformedProps;

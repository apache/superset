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

export type EchartsBulletFormData = QueryFormData & {
  metric?: QueryFormMetric;
  /** Comma-separated threshold values shaded as background bands */
  ranges?: string;
  rangeLabels?: string;
  /** Comma-separated values drawn as point markers */
  markers?: string;
  markerLabels?: string;
  /** Comma-separated values drawn as vertical lines */
  markerLines?: string;
  markerLineLabels?: string;
  yAxisFormat?: string;
};

export interface EchartsBulletChartProps extends BaseChartProps<EchartsBulletFormData> {
  formData: EchartsBulletFormData;
}

export type BulletChartTransformedProps =
  BaseTransformedProps<EchartsBulletFormData> & CrossFilterTransformedProps;

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
  CrossFilterTransformedProps,
} from '../types';

export type EchartsRoseFormData = QueryFormData & {
  metrics?: QueryFormMetric[];
  groupby?: QueryFormColumn[];
  colorScheme?: string;
  dateTimeFormat?: string;
  numberFormat?: string;
  richTooltip?: boolean;
  roseAreaProportion?: boolean;
  timeCompare?: string[];
  comparisonType?: string;
};

export interface EchartsRoseChartProps extends BaseChartProps<EchartsRoseFormData> {
  formData: EchartsRoseFormData;
}

/** One series' slice of one time period, precomputed for both views. */
export interface RosePeriodDatum {
  /** display name of the series */
  seriesName: string;
  /** raw metric value */
  value: number;
  /** radius increment plotted in the rose view (see transformProps) */
  increment: number;
}

/** A single angular sector of the rose: one time period. */
export interface RosePeriod {
  /** epoch timestamp of the period */
  time: number;
  /** formatted axis/tooltip label for the period */
  label: string;
  entries: RosePeriodDatum[];
}

export type RoseChartTransformedProps =
  BaseTransformedProps<EchartsRoseFormData> &
    CrossFilterTransformedProps & {
      periods: RosePeriod[];
      seriesNames: string[];
      numberFormat?: string;
      sliceId?: number;
      colorScheme?: string;
    };

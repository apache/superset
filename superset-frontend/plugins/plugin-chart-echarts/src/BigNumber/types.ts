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

import type { EChartsCoreOption } from 'echarts/core';
import {
  ChartDataResponseResult,
  ContextMenuFilters,
  DataRecordValue,
  QueryFormData,
  QueryFormMetric,
  TimeFormatter,
  ValueFormatter,
} from '@superset-ui/core';
import { ColorFormatters } from '@superset-ui/chart-controls';
import { BaseChartProps, Refs } from '../types';

export interface BigNumberDatum {
  [key: string]: number | null;
}

export type BigNumberTotalFormData = QueryFormData & {
  metric?: QueryFormMetric;
  yAxisFormat?: string;
  forceTimestampFormatting?: boolean;
};

export type BigNumberWithTrendlineFormData = BigNumberTotalFormData & {
  colorPicker: {
    r: number;
    g: number;
    b: number;
  };
  compareLag?: string | number;
};

export interface BigNumberTotalChartDataResponseResult
  extends ChartDataResponseResult {
  data: BigNumberDatum[];
}

export type BigNumberTotalChartProps =
  BaseChartProps<BigNumberTotalFormData> & {
    formData: BigNumberTotalFormData;
    queriesData: BigNumberTotalChartDataResponseResult[];
  };

export type BigNumberWithTrendlineChartProps =
  BaseChartProps<BigNumberWithTrendlineFormData> & {
    formData: BigNumberWithTrendlineFormData;
  };

export type TimeSeriesDatum = [number, number | null];

export type BigNumberVizProps = {
  className?: string;
  width: number;
  height: number;
  bigNumber?: DataRecordValue;
  bigNumberFallback?: TimeSeriesDatum;
  headerFormatter: ValueFormatter | TimeFormatter;
  formatTime?: TimeFormatter;
  headerFontSize: number;
  kickerFontSize?: number;
  subheader: string;
  subheaderFontSize: number;
  showTimestamp?: boolean;
  showTrendLine?: boolean;
  startYAxisAtZero?: boolean;
  timeRangeFixed?: boolean;
  timestamp?: DataRecordValue;
  trendLineData?: TimeSeriesDatum[];
  mainColor?: string;
  echartOptions?: EChartsCoreOption;
  onContextMenu?: (
    clientX: number,
    clientY: number,
    filters?: ContextMenuFilters,
  ) => void;
  xValueFormatter?: TimeFormatter;
  formData?: BigNumberWithTrendlineFormData;
  refs: Refs;
  colorThresholdFormatters?: ColorFormatters;
};

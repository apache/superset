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
  QueryFormColumn,
  QueryFormData,
  QueryFormMetric,
  RgbaColor,
} from '@superset-ui/core';
import {
  BaseChartProps,
  BaseTransformedProps,
  LegendFormData,
  TitleFormData,
} from '../types';

export type EchartsCandlestickFormData = QueryFormData &
  LegendFormData &
  TitleFormData & {
    xAxis: QueryFormColumn;
    open: QueryFormMetric;
    close: QueryFormMetric;
    high: QueryFormMetric;
    low: QueryFormMetric;
    series?: QueryFormColumn | QueryFormColumn[];
    increaseColor: RgbaColor;
    decreaseColor: RgbaColor;
    increaseLabel?: string;
    decreaseLabel?: string;
    showXAxis: boolean;
    showYAxis: boolean;
    xAxisTimeFormat?: string;
    xAxisLabelRotation: number;
    xAxisLabelInterval: string;
    yAxisFormat: string;
    tooltipTimeFormat?: string;
    tooltipValuesFormat?: string;
    zoomable: boolean;
    movingAverages?: (number | string)[];
    echartOptions?: string;
  };

export interface EchartsCandlestickChartProps extends BaseChartProps<EchartsCandlestickFormData> {
  formData: EchartsCandlestickFormData;
  queriesData: ChartDataResponseResult[];
}

export type CandlestickChartTransformedProps =
  BaseTransformedProps<EchartsCandlestickFormData>;

export type CandlestickChartProps = ChartProps<EchartsCandlestickFormData>;

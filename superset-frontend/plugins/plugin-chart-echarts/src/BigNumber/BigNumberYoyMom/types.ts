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
  Currency,
  QueryFormColumn,
  QueryFormData,
  QueryFormMetric,
} from '@superset-ui/core';
import { BaseChartProps, Refs } from '../../types';

export type RGBColor = { r: number; g: number; b: number };

export type BigNumberYoyMomFormData = QueryFormData & {
  metric?: QueryFormMetric;
  granularity_sqla?: QueryFormColumn;
  timeGrainSqla?: string;
  yAxisFormat?: string;
  currencyFormat?: Currency;
  headerText?: string;
  titleFontSize?: number;
  titleColor?: RGBColor;
  titleLeft?: number;
  titleTop?: number;
  bigNumberFontSize?: number;
  bigNumberColor?: RGBColor;
  bigNumberLeft?: number;
  bigNumberTop?: number;
  showComparison1?: boolean;
  comparison1Label?: string;
  comparison1Mode?: 'time_shift' | 'metric';
  comparison1Offset?: string;
  comparison1Column?: QueryFormMetric;
  comparison1PercentDifferenceFormat?: string;
  /** @deprecated Use comparisonGap and swapComparisonOrder. */
  comparison1Left?: number;
  showComparison2?: boolean;
  comparison2Label?: string;
  comparison2Mode?: 'time_shift' | 'metric';
  comparison2Offset?: string;
  comparison2Column?: QueryFormMetric;
  comparison2PercentDifferenceFormat?: string;
  /** @deprecated Use comparisonGap and swapComparisonOrder. */
  comparison2Left?: number;
  comparisonGap?: number;
  swapComparisonOrder?: boolean;
  comparisonFontSize?: number;
  comparisonTop?: number;
  comparisonPositiveColor?: RGBColor;
  comparisonNegativeColor?: RGBColor;
  comparisonZeroColor?: RGBColor;
  percentDifferenceFormat?: string;
};

export type BigNumberYoyMomDatum = {
  [key: string]: number | string | null;
};

export type BigNumberYoyMomChartDataResponseResult =
  ChartDataResponseResult & {
    data: BigNumberYoyMomDatum[];
  };

export type BigNumberYoyMomChartProps =
  BaseChartProps<BigNumberYoyMomFormData> & {
    formData: BigNumberYoyMomFormData;
    queriesData: BigNumberYoyMomChartDataResponseResult[];
  };

export type BigNumberYoyMomProps = {
  width: number;
  height: number;
  echartOptions: EChartsCoreOption;
  refs: Refs;
  formData?: BigNumberYoyMomFormData;
};

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
  DataRecordValue,
  QueryFormColumn,
  SetDataMaskHook,
} from '@superset-ui/core';
import { EChartsCoreOption, ECharts } from 'echarts';
import { TooltipMarker } from 'echarts/types/src/util/format';
import { OptionName } from 'echarts/types/src/util/types';

export type EchartsStylesProps = {
  height: number;
  width: number;
};

export interface EchartsProps {
  height: number;
  width: number;
  echartOptions: EChartsCoreOption;
  eventHandlers?: EventHandlers;
  zrEventHandlers?: EventHandlers;
  selectedValues?: Record<number, string>;
  forceClear?: boolean;
}

export interface EchartsHandler {
  getEchartInstance: () => ECharts | undefined;
}

export enum ForecastSeriesEnum {
  Observation = '',
  ForecastTrend = '__yhat',
  ForecastUpper = '__yhat_upper',
  ForecastLower = '__yhat_lower',
}

export type ForecastSeriesContext = {
  name: string;
  type: ForecastSeriesEnum;
};

export enum LegendOrientation {
  Top = 'top',
  Bottom = 'bottom',
  Left = 'left',
  Right = 'right',
}

export enum LegendType {
  Scroll = 'scroll',
  Plain = 'plain',
}

export type ProphetValue = {
  marker: TooltipMarker;
  observation?: number;
  forecastTrend?: number;
  forecastLower?: number;
  forecastUpper?: number;
};

export type EchartsLegendFormData = {
  legendMargin: number | null | string;
  legendOrientation: LegendOrientation;
  legendType: LegendType;
  showLegend: boolean;
};

export const DEFAULT_LEGEND_FORM_DATA: EchartsLegendFormData = {
  legendMargin: null,
  legendOrientation: LegendOrientation.Top,
  legendType: LegendType.Scroll,
  showLegend: false,
};

export type EventHandlers = Record<string, { (props: any): void }>;

export enum LabelPositionEnum {
  Top = 'top',
  Left = 'left',
  Right = 'right',
  Bottom = 'bottom',
  Inside = 'inside',
  InsideLeft = 'insideLeft',
  InsideRight = 'insideRight',
  InsideTop = 'insideTop',
  InsideBottom = 'insideBottom',
  InsideTopLeft = 'insideTopLeft',
  InsideBottomLeft = 'insideBottomLeft',
  InsideTopRight = 'insideTopRight',
  InsideBottomRight = 'insideBottomRight',
}

export interface EChartTransformedProps<F> {
  formData: F;
  height: number;
  width: number;
  echartOptions: EChartsCoreOption;
  emitFilter: boolean;
  setDataMask: SetDataMaskHook;
  labelMap: Record<string, DataRecordValue[]>;
  groupby: QueryFormColumn[];
  selectedValues: Record<number, string>;
  legendData?: OptionName[];
}

export interface EchartsTitleFormData {
  xAxisTitle: string;
  xAxisTitleMargin: number;
  yAxisTitle: string;
  yAxisTitleMargin: number;
  yAxisTitlePosition: string;
}

export const DEFAULT_TITLE_FORM_DATA: EchartsTitleFormData = {
  xAxisTitle: '',
  xAxisTitleMargin: 0,
  yAxisTitle: '',
  yAxisTitleMargin: 0,
  yAxisTitlePosition: 'Top',
};

export * from './Timeseries/types';

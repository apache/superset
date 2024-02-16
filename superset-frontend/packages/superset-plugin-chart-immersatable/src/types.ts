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
import { QueryFormData, supersetTheme } from '@superset-ui/core';

export interface SupersetPluginChartImmersatableStylesProps {
  height: number;
  width: number;
  headerFontSize: keyof typeof supersetTheme.typography.sizes;
  boldText: boolean;
}

interface SupersetPluginChartHelloWorldCustomizeProps {
  headerText: string;
}

export type SupersetPluginChartHelloWorldQueryFormData = QueryFormData &
  SupersetPluginChartImmersatableStylesProps &
  SupersetPluginChartHelloWorldCustomizeProps;

export type SupersetPluginChartImmersatableProps =
  SupersetPluginChartImmersatableStylesProps &
    SupersetPluginChartHelloWorldCustomizeProps & {
      data: DataType[];
      // add typing here for the props you pass in from transformProps.ts!
    };

// TData
// export type VaccineData = {
//   clinical_trials: string
//   count: number
//   chart_data: string
// }

export type ChartGenericDataItem = Record<string, string | number>;

export type ChartGenericData = ChartGenericDataItem[];

export type ChartDataItem = {
  xAxis: string | number;
  yAxis: number;
  seriesField?: string;
  colors?: ColorsVariants;
  color?: string;
  meta?: Record<string, string | number>;
};

export type ColorsVariants = {
  light: string;
  main: string;
  dark: string;
};

export type ChartData = ChartDataItem[];
export type ChartMargin = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};
export type ChartDataType = 'date' | 'string' | 'number';

export type DataType = Record<string, unknown>;

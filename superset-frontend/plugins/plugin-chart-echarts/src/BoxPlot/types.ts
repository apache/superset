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
import { QueryFormData } from '@superset-ui/core';
import {
  BaseChartProps,
  BaseTransformedProps,
  ContextMenuTransformedProps,
  CrossFilterTransformedProps,
  TitleFormData,
} from '../types';
import { DEFAULT_TITLE_FORM_DATA } from '../constants';

export type BoxPlotQueryFormData = QueryFormData & {
  numberFormat?: string;
  whiskerOptions?: BoxPlotFormDataWhiskerOptions;
  xTickLayout?: BoxPlotFormXTickLayout;
  yAxisSlider?: boolean;
  distributionStyle?: BoxPlotDistributionStyle;
  densityBandwidth?: number | string;
  showInnerBox?: boolean;
} & TitleFormData;

export type BoxPlotDistributionStyle = 'box' | 'violin';

export type Stats = {
  min: number | null;
  q1: number | null;
  median: number;
  q3: number | null;
  max: number | null;
  mean: number | null;
  count: number | null;
  outliers: number[] | null;
};

export type ViolinItem = {
  name: string;
  color: string;
  isFiltered: boolean;
  density: DensityCurve;
  peak: number;
  stats: Stats;
};

export type BoxPlotFormDataWhiskerOptions =
  | 'Tukey'
  | 'Min/max (no outliers)'
  | '2/98 percentiles'
  | '5/95 percentiles'
  | '9/91 percentiles'
  | '10/90 percentiles';

export type BoxPlotFormXTickLayout =
  | '45°'
  | '90°'
  | 'auto'
  | 'flat'
  | 'staggered';

// @ts-expect-error
export const DEFAULT_FORM_DATA: BoxPlotQueryFormData = {
  ...DEFAULT_TITLE_FORM_DATA,
  distributionStyle: 'box',
  densityBandwidth: 1,
  showInnerBox: true,
};

export type DensityCurve = [number, number][];

export type BoxPlotViolinWidthScale = 'per_group' | 'shared';

export interface EchartsBoxPlotChartProps extends BaseChartProps<BoxPlotQueryFormData> {
  formData: BoxPlotQueryFormData;
}

export type BoxPlotChartTransformedProps =
  BaseTransformedProps<BoxPlotQueryFormData> &
    CrossFilterTransformedProps &
    ContextMenuTransformedProps;

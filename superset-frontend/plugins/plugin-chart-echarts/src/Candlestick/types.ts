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
  ContextMenuTransformedProps,
  CrossFilterTransformedProps,
  TitleFormData,
} from '../types';
import { DEFAULT_TITLE_FORM_DATA } from '../constants';

export type CandlestickQueryFormData = QueryFormData & {
  /** Metric for the opening price */
  open: QueryFormMetric;
  /** Metric for the closing price */
  close: QueryFormMetric;
  /** Metric for the lowest price */
  low: QueryFormMetric;
  /** Metric for the highest price */
  high: QueryFormMetric;
  /** Enable/disable zoom features */
  zoomable?: boolean;
} & TitleFormData;

export const DEFAULT_FORM_DATA: CandlestickQueryFormData = {
  ...DEFAULT_TITLE_FORM_DATA,
  open: '',
  close: '',
  low: '',
  high: '',
};

export interface EchartsCandlestickChartProps extends BaseChartProps<CandlestickQueryFormData> {
  formData: CandlestickQueryFormData;
}

export type CandlestickChartTransformedProps =
  BaseTransformedProps<CandlestickQueryFormData> &
    CrossFilterTransformedProps &
    ContextMenuTransformedProps;

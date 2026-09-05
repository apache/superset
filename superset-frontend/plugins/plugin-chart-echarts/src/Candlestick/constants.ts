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
import { t } from '@apache-superset/core/translation';
import {
  DEFAULT_LEGEND_FORM_DATA,
  DEFAULT_TITLE_FORM_DATA,
} from '../constants';
import { defaultXAxis } from '../defaults';
import { EchartsCandlestickFormData } from './types';

export const OHLC_LABELS = {
  OPEN: t('Open'),
  CLOSE: t('Close'),
  LOW: t('Low'),
  HIGH: t('High'),
};

export const DIRECTION_LABELS = {
  INCREASE: t('Increase'),
  DECREASE: t('Decrease'),
};

export const CANDLESTICK_SERIES_NAME = t('Candlestick');

export const DEFAULT_INCREASE_COLOR = { r: 90, g: 193, b: 137, a: 1 };
export const DEFAULT_DECREASE_COLOR = { r: 224, g: 67, b: 85, a: 1 };

export const DEFAULT_FORM_DATA: Partial<EchartsCandlestickFormData> = {
  ...DEFAULT_LEGEND_FORM_DATA,
  ...DEFAULT_TITLE_FORM_DATA,
  candlestickSeriesName: CANDLESTICK_SERIES_NAME,
  increaseColor: DEFAULT_INCREASE_COLOR,
  decreaseColor: DEFAULT_DECREASE_COLOR,
  showXAxis: true,
  showYAxis: true,
  zoomable: false,
  xAxisLabelRotation: defaultXAxis.xAxisLabelRotation,
  xAxisLabelInterval: defaultXAxis.xAxisLabelInterval,
  yAxisFormat: 'SMART_NUMBER',
};

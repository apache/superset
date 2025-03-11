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

import { JsonValue, t, TimeGranularity } from '@superset-ui/core';
import { ReactNode } from 'react';
import {
  LabelPositionEnum,
  LegendFormData,
  LegendOrientation,
  LegendType,
  TitleFormData,
} from './types';

// eslint-disable-next-line import/prefer-default-export
export const NULL_STRING = '<NULL>';

export const TIMESERIES_CONSTANTS = {
  gridOffsetRight: 20,
  gridOffsetLeft: 20,
  gridOffsetTop: 20,
  gridOffsetBottom: 20,
  gridOffsetBottomZoomable: 80,
  legendRightTopOffset: 30,
  legendTopRightOffset: 55,
  zoomBottom: 30,
  toolboxTop: 0,
  toolboxRight: 5,
  dataZoomStart: 0,
  dataZoomEnd: 100,
  yAxisLabelTopOffset: 20,
  extraControlsOffset: 22,
};

export const LABEL_POSITION: [LabelPositionEnum, string][] = [
  [LabelPositionEnum.Top, 'Top'],
  [LabelPositionEnum.Left, 'Left'],
  [LabelPositionEnum.Right, 'Right'],
  [LabelPositionEnum.Bottom, 'Bottom'],
  [LabelPositionEnum.Inside, 'Inside'],
  [LabelPositionEnum.InsideLeft, 'Inside left'],
  [LabelPositionEnum.InsideRight, 'Inside right'],
  [LabelPositionEnum.InsideTop, 'Inside top'],
  [LabelPositionEnum.InsideBottom, 'Inside bottom'],
  [LabelPositionEnum.InsideTopLeft, 'Inside top left'],
  [LabelPositionEnum.InsideBottomLeft, 'Inside bottom left'],
  [LabelPositionEnum.InsideTopRight, 'Inside top right'],
  [LabelPositionEnum.InsideBottomRight, 'Inside bottom right'],
];

export enum OpacityEnum {
  Transparent = 0,
  SemiTransparent = 0.3,
  DerivedSeries = 0.7,
  NonTransparent = 1,
}

export enum StackControlsValue {
  Stack = 'Stack',
  Stream = 'Stream',
  Expand = 'Expand',
}

export const StackControlOptions: [
  JsonValue,
  Exclude<ReactNode, null | undefined | boolean>,
][] = [
  [null, t('None')],
  [StackControlsValue.Stack, t('Stack')],
  [StackControlsValue.Stream, t('Stream')],
];

export const AreaChartStackControlOptions: [
  JsonValue,
  Exclude<ReactNode, null | undefined | boolean>,
][] = [...StackControlOptions, [StackControlsValue.Expand, t('Expand')]];

export const TIMEGRAIN_TO_TIMESTAMP = {
  [TimeGranularity.HOUR]: 3600 * 1000,
  [TimeGranularity.DAY]: 3600 * 1000 * 24,
  [TimeGranularity.MONTH]: 3600 * 1000 * 24 * 31,
  [TimeGranularity.QUARTER]: 3600 * 1000 * 24 * 31 * 3,
  [TimeGranularity.YEAR]: 3600 * 1000 * 24 * 31 * 12,
};

export const DEFAULT_LEGEND_FORM_DATA: LegendFormData = {
  legendMargin: null,
  legendOrientation: LegendOrientation.Top,
  legendType: LegendType.Scroll,
  showLegend: true,
};

export const DEFAULT_TITLE_FORM_DATA: TitleFormData = {
  xAxisTitle: '',
  xAxisTitleMargin: 0,
  yAxisTitle: '',
  yAxisTitleMargin: 0,
  yAxisTitlePosition: 'Top',
};

export { DEFAULT_FORM_DATA } from './Timeseries/constants';

// How far away from the mouse should the tooltip be
export const TOOLTIP_POINTER_MARGIN = 10;

// If no satisfactory position can be found, how far away
// from the edge of the window should the tooltip be kept
export const TOOLTIP_OVERFLOW_MARGIN = 5;

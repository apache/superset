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
import { LabelPositionEnum } from './types';

// eslint-disable-next-line import/prefer-default-export
export const NULL_STRING = '<NULL>';

export const TIMESERIES_CONSTANTS = {
  gridOffsetRight: 40,
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
  [LabelPositionEnum.InsideBottomLeft, 'Inside left'],
  [LabelPositionEnum.InsideBottomRight, 'Inside right'],
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
  NonTransparent = 1,
}

export enum AreaChartExtraControlsValue {
  Stack = 'Stack',
  Expand = 'Expand',
}

export const AreaChartExtraControlsOptions: [
  JsonValue,
  Exclude<ReactNode, null | undefined | boolean>,
][] = [
  [null, t('None')],
  [AreaChartExtraControlsValue.Stack, t('Stack')],
  [AreaChartExtraControlsValue.Expand, t('Expand')],
];

export const TIMEGRAIN_TO_TIMESTAMP = {
  [TimeGranularity.HOUR]: 3600 * 1000,
  [TimeGranularity.DAY]: 3600 * 1000 * 24,
  [TimeGranularity.MONTH]: 3600 * 1000 * 24 * 31,
  [TimeGranularity.QUARTER]: 3600 * 1000 * 24 * 31 * 3,
  [TimeGranularity.YEAR]: 3600 * 1000 * 24 * 31 * 12,
};

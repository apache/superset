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
export const CONTRIBUTION_SUFFIX = '__contribution' as const;

export enum OpacityEnum {
  Transparent = 0,
  SemiTransparent = 0.3,
  DerivedSeries = 0.7,
  NonTransparent = 1,
}

// in plugins/plugin-chart-hierarchical-pie/src/constants.ts

export const DEFAULT_LEGEND_FORM_DATA = {
  legendMargin: null,
  legendOrientation: 'top',
  legendType: 'scroll',
  showLegend: true,
};

export const StackControlOptions = [
  ['stack', 'Stack'],
  ['expand', 'Expand'],
  ['stream', 'Stream'],
];

export const defaultXAxis = {
  xAxisLabelRotation: 0, // Adjust this if you prefer a different default
};

export const DEFAULT_FORM_DATA = {
  showLegend: true,
  legendOrientation: 'top',
  legendType: 'scroll',
  groupby: [],
  metric: undefined,
  numberFormat: 'SMART_NUMBER',
  labelType: 'key',
  donut: false,
  innerRadius: 30,
  outerRadius: 80,
  percentageThreshold: 0,
  truncateXAxis: true,
  xAxisBounds: [null, null],
};

// Tooltip positioning constants used to prevent overflow clipping
export const TOOLTIP_OVERFLOW_MARGIN = 8;
export const TOOLTIP_POINTER_MARGIN = 16;

// plugins/plugin-chart-hierarchical-pie/src/constants.ts

export const NULL_STRING = 'NULL';

// plugins/plugin-chart-hierarchical-pie/src/constants.ts

// Stack control options
export enum StackControlsValue {
  NoStacked = 'no',
  Stacked = 'stack',
  Expand = 'expand',
}

export const TIMESERIES_CONSTANTS = {
  legendRightTopOffset: 20,
  legendTopRightOffset: 20,
  gridOffsetRight: 50,
  gridOffsetLeft: 10,
  gridOffsetBottom: 40,
  gridOffsetTop: 10,
};

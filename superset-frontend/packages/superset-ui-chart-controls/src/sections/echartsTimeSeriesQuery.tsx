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
import { hasGenericChartAxes, t } from '@superset-ui/core';
import { ControlPanelSectionConfig, ControlSetRow } from '../types';
import {
  contributionModeControl,
  xAxisForceCategoricalControl,
  xAxisSortAscControl,
  xAxisSortControl,
  xAxisSortSeriesAscendingControl,
  xAxisSortSeriesControl,
} from '../shared-controls';

const controlsWithoutXAxis: ControlSetRow[] = [
  ['metrics'],
  ['groupby'],
  [contributionModeControl],
  ['adhoc_filters'],
  ['limit'],
  ['timeseries_limit_metric'],
  ['order_desc'],
  ['row_limit'],
  ['truncate_metric'],
  ['show_empty_columns'],
];

export const echartsTimeSeriesQuery: ControlPanelSectionConfig = {
  label: t('Query'),
  expanded: true,
  controlSetRows: [
    [hasGenericChartAxes ? 'x_axis' : null],
    [hasGenericChartAxes ? 'time_grain_sqla' : null],
    ...controlsWithoutXAxis,
  ],
};

export const echartsTimeSeriesQueryWithXAxisSort: ControlPanelSectionConfig = {
  label: t('Query'),
  expanded: true,
  controlSetRows: [
    [hasGenericChartAxes ? 'x_axis' : null],
    [hasGenericChartAxes ? 'time_grain_sqla' : null],
    [hasGenericChartAxes ? xAxisForceCategoricalControl : null],
    [hasGenericChartAxes ? xAxisSortControl : null],
    [hasGenericChartAxes ? xAxisSortAscControl : null],
    [hasGenericChartAxes ? xAxisSortSeriesControl : null],
    [hasGenericChartAxes ? xAxisSortSeriesAscendingControl : null],
    ...controlsWithoutXAxis,
  ],
};

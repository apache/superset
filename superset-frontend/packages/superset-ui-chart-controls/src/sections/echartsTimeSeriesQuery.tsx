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
  ContributionType,
  ensureIsArray,
  getColumnLabel,
  getMetricLabel,
  hasGenericChartAxes,
  UnsortedXAxis,
  isEqualArray,
  t,
  defaultAxisSortValue,
} from '@superset-ui/core';
import {
  ControlPanelSectionConfig,
  ControlSetItem,
  ControlSetRow,
} from '../types';
import { emitFilterControl } from '../shared-controls/emitFilterControl';

const controlsWithoutXAxis: ControlSetRow[] = [
  ['metrics'],
  ['groupby'],
  [
    {
      name: 'contributionMode',
      config: {
        type: 'SelectControl',
        label: t('Contribution Mode'),
        default: null,
        choices: [
          [null, t('None')],
          [ContributionType.Row, t('Row')],
          [ContributionType.Column, t('Series')],
        ],
        description: t('Calculate contribution per series or row'),
      },
    },
  ],
  ['adhoc_filters'],
  emitFilterControl,
  ['limit'],
  ['timeseries_limit_metric'],
  ['order_desc'],
  ['row_limit'],
  ['truncate_metric'],
  ['show_empty_columns'],
];

const xAxisSort: ControlSetItem = {
  name: 'x_axis_sort',
  config: {
    type: 'XAxisSortControl',
    label: t('X-Axis Sort By'),
    description: '',
    shouldMapStateToProps: (prevState, state) => {
      const prevOptions = [
        getColumnLabel(prevState.form_data.x_axis),
        ...ensureIsArray(prevState.form_data.metrics).map(metric =>
          getMetricLabel(metric),
        ),
      ];
      const currOptions = [
        getColumnLabel(state.form_data.x_axis),
        ...ensureIsArray(state.form_data.metrics).map(metric =>
          getMetricLabel(metric),
        ),
      ];
      return !isEqualArray(prevOptions, currOptions);
    },
    mapStateToProps: state => {
      const choices = [
        getColumnLabel(state.form_data.x_axis),
        ...ensureIsArray(state.form_data.metrics).map(metric =>
          getMetricLabel(metric),
        ),
      ].filter(Boolean);

      const xAxisSortByOptions = [UnsortedXAxis, ...choices].map(entry => ({
        value: entry,
        label: entry,
      }));
      return {
        xAxisSortByOptions,
      };
    },
    visibility: ({ controls }) =>
      Array.isArray(controls?.groupby?.value) &&
      controls?.groupby?.value.length === 0,
    default: defaultAxisSortValue,
  },
};

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
    [hasGenericChartAxes ? xAxisSort : null],
    ...controlsWithoutXAxis,
  ],
};

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
  isDefined,
  QueryFormColumn,
  QueryFormMetric,
  t,
} from '@superset-ui/core';
import {
  ControlPanelState,
  ControlState,
  ControlStateMapping,
  isDataset,
} from '../types';
import { isTemporalColumn } from '../utils';

export const contributionModeControl = {
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
};

const xAxisSortVisibility = ({ controls }: { controls: ControlStateMapping }) =>
  isDefined(controls?.x_axis?.value) &&
  !isTemporalColumn(
    getColumnLabel(controls?.x_axis?.value as QueryFormColumn),
    controls?.datasource?.datasource,
  ) &&
  Array.isArray(controls?.groupby?.value) &&
  controls.groupby.value.length === 0;

export const xAxisSortControl = {
  name: 'x_axis_sort',
  config: {
    type: 'XAxisSortControl',
    label: (state: ControlPanelState) =>
      state.form_data?.orientation === 'horizontal'
        ? t('Y-Axis Sort By')
        : t('X-Axis Sort By'),
    description: t('Decides which column to sort the base axis by.'),
    shouldMapStateToProps: () => true,
    mapStateToProps: (state: ControlPanelState, controlState: ControlState) => {
      const { controls, datasource } = state;
      const dataset = isDataset(datasource) ? datasource : undefined;
      const columns = [controls?.x_axis?.value as QueryFormColumn].filter(
        Boolean,
      );
      const metrics = [
        ...ensureIsArray(controls?.metrics?.value as QueryFormMetric),
        controls?.timeseries_limit_metric?.value as QueryFormMetric,
      ].filter(Boolean);
      const options = [
        ...columns.map(column => {
          const value = getColumnLabel(column);
          return {
            value,
            label: dataset?.verbose_map?.[value] || value,
          };
        }),
        ...metrics.map(metric => {
          const value = getMetricLabel(metric);
          return {
            value,
            label: dataset?.verbose_map?.[value] || value,
          };
        }),
      ];

      const shouldReset = !(
        typeof controlState.value === 'string' &&
        options.map(option => option.value).includes(controlState.value) &&
        !isTemporalColumn(
          getColumnLabel(controls?.x_axis?.value as QueryFormColumn),
          controls?.datasource?.datasource,
        )
      );

      return {
        shouldReset,
        options,
      };
    },
    visibility: xAxisSortVisibility,
  },
};

export const xAxisSortAscControl = {
  name: 'x_axis_sort_asc',
  config: {
    type: 'CheckboxControl',
    label: (state: ControlPanelState) =>
      state.form_data?.orientation === 'horizontal'
        ? t('Y-Axis Sort Ascending')
        : t('X-Axis Sort Ascending'),
    default: true,
    description: t('Whether to sort ascending or descending on the base Axis.'),
    visibility: xAxisSortVisibility,
  },
};

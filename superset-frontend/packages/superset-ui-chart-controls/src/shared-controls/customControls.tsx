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
  isEqualArray,
  QueryFormColumn,
  QueryFormMetric,
  t,
} from '@superset-ui/core';
import { ControlPanelState, ControlState, ControlStateMapping } from '../types';
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
    label: t('X-Axis Sort By'),
    description: t('Whether to sort descending or ascending on the X-Axis.'),
    shouldMapStateToProps: (
      prevState: ControlPanelState,
      state: ControlPanelState,
    ) => {
      const prevOptions = [
        getColumnLabel(prevState?.controls?.x_axis?.value as QueryFormColumn),
        ...ensureIsArray(prevState?.controls?.metrics?.value).map(metric =>
          getMetricLabel(metric as QueryFormMetric),
        ),
      ];
      const currOptions = [
        getColumnLabel(state?.controls?.x_axis?.value as QueryFormColumn),
        ...ensureIsArray(state?.controls?.metrics?.value).map(metric =>
          getMetricLabel(metric as QueryFormMetric),
        ),
      ];
      return !isEqualArray(prevOptions, currOptions);
    },
    mapStateToProps: (
      { controls }: { controls: ControlStateMapping },
      controlState: ControlState,
    ) => {
      const choices = [
        getColumnLabel(controls?.x_axis?.value as QueryFormColumn),
        ...ensureIsArray(controls?.metrics?.value).map(metric =>
          getMetricLabel(metric as QueryFormMetric),
        ),
      ].filter(Boolean);
      const shouldReset = !(
        typeof controlState.value === 'string' &&
        choices.includes(controlState.value) &&
        !isTemporalColumn(
          getColumnLabel(controls?.x_axis?.value as QueryFormColumn),
          controls?.datasource?.datasource,
        )
      );

      return {
        shouldReset,
        options: choices.map(entry => ({
          value: entry,
          label: entry,
        })),
      };
    },
    visibility: xAxisSortVisibility,
  },
};

export const xAxisSortAscControl = {
  name: 'x_axis_sort_asc',
  config: {
    type: 'CheckboxControl',
    label: t('X-Axis Sort Ascending'),
    default: true,
    description: t('Whether to sort descending or ascending on the X-Axis.'),
    visibility: xAxisSortVisibility,
  },
};

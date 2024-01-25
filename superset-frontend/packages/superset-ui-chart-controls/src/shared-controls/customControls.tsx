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
  GenericDataType,
  getColumnLabel,
  getMetricLabel,
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
import {
  DEFAULT_XAXIS_SORT_SERIES_DATA,
  SORT_SERIES_CHOICES,
} from '../constants';
import { checkColumnType } from '../utils/checkColumnType';

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

function isForcedCategorical(controls: ControlStateMapping): boolean {
  return (
    checkColumnType(
      getColumnLabel(controls?.x_axis?.value as QueryFormColumn),
      controls?.datasource?.datasource,
      [GenericDataType.NUMERIC],
    ) && !!controls?.xAxisForceCategorical?.value
  );
}

function isSortable(controls: ControlStateMapping): boolean {
  return (
    isForcedCategorical(controls) ||
    checkColumnType(
      getColumnLabel(controls?.x_axis?.value as QueryFormColumn),
      controls?.datasource?.datasource,
      [GenericDataType.STRING, GenericDataType.BOOLEAN],
    )
  );
}

const xAxisSortVisibility = ({ controls }: { controls: ControlStateMapping }) =>
  isSortable(controls) &&
  ensureIsArray(controls?.groupby?.value).length === 0 &&
  ensureIsArray(controls?.metrics?.value).length === 1;

const xAxisMultiSortVisibility = ({
  controls,
}: {
  controls: ControlStateMapping;
}) =>
  isSortable(controls) &&
  (!!ensureIsArray(controls?.groupby?.value).length ||
    ensureIsArray(controls?.metrics?.value).length > 1);

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
      const metricLabels = [...new Set(metrics.map(getMetricLabel))];
      const options = [
        ...columns.map(column => {
          const value = getColumnLabel(column);
          return {
            value,
            label: dataset?.verbose_map?.[value] || value,
          };
        }),
        ...metricLabels.map(value => ({
          value,
          label: dataset?.verbose_map?.[value] || value,
        })),
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
    visibility: ({ controls }: { controls: ControlStateMapping }) =>
      controls?.x_axis_sort?.value !== undefined &&
      xAxisSortVisibility({ controls }),
  },
};

export const xAxisForceCategoricalControl = {
  name: 'xAxisForceCategorical',
  config: {
    type: 'CheckboxControl',
    label: () => t('Force categorical'),
    default: false,
    description: t('Treat values as categorical.'),
    initialValue: (control: ControlState, state: ControlPanelState | null) =>
      state?.form_data?.x_axis_sort !== undefined || control.value,
    renderTrigger: true,
    visibility: ({ controls }: { controls: ControlStateMapping }) =>
      checkColumnType(
        getColumnLabel(controls?.x_axis?.value as QueryFormColumn),
        controls?.datasource?.datasource,
        [GenericDataType.NUMERIC],
      ),
    shouldMapStateToProps: () => true,
  },
};

export const xAxisSortSeriesControl = {
  name: 'x_axis_sort_series',
  config: {
    type: 'SelectControl',
    freeForm: false,
    label: (state: ControlPanelState) =>
      state.form_data?.orientation === 'horizontal'
        ? t('Y-Axis Sort By')
        : t('X-Axis Sort By'),
    choices: SORT_SERIES_CHOICES,
    default: DEFAULT_XAXIS_SORT_SERIES_DATA.sort_series_type,
    renderTrigger: true,
    description: t('Decides which measure to sort the base axis by.'),
    visibility: xAxisMultiSortVisibility,
  },
};

export const xAxisSortSeriesAscendingControl = {
  name: 'x_axis_sort_series_ascending',
  config: {
    type: 'CheckboxControl',
    label: (state: ControlPanelState) =>
      state.form_data?.orientation === 'horizontal'
        ? t('Y-Axis Sort Ascending')
        : t('X-Axis Sort Ascending'),
    default: DEFAULT_XAXIS_SORT_SERIES_DATA.sort_series_ascending,
    description: t('Whether to sort ascending or descending on the base Axis.'),
    renderTrigger: true,
    visibility: ({ controls }: { controls: ControlStateMapping }) =>
      controls?.x_axis_sort_series?.value !== undefined &&
      xAxisMultiSortVisibility({ controls }),
  },
};

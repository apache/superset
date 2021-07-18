/* eslint-disable camelcase */
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
import { t, validateNonEmpty } from '@superset-ui/core';
import { ExtraControlProps, SharedControlConfig } from '../types';
import { TIME_COLUMN_OPTION, TIME_FILTER_LABELS } from '../constants';

export const dndGroupByControl: SharedControlConfig<'DndColumnSelect'> = {
  type: 'DndColumnSelect',
  label: t('Group by'),
  default: [],
  description: t('One or many columns to group by'),
  mapStateToProps(state, { includeTime }) {
    const newState: ExtraControlProps = {};
    if (state.datasource) {
      const options = state.datasource.columns.filter(c => c.groupby);
      if (includeTime) {
        options.unshift(TIME_COLUMN_OPTION);
      }
      newState.options = Object.fromEntries(options.map(option => [option.column_name, option]));
      newState.savedMetrics = state.datasource.metrics || [];
    }
    return newState;
  },
};

export const dndColumnsControl: typeof dndGroupByControl = {
  ...dndGroupByControl,
  label: t('Columns'),
  description: t('One or many columns to pivot as columns'),
};

export const dndSeries: typeof dndGroupByControl = {
  ...dndGroupByControl,
  label: t('Series'),
  multi: false,
  default: null,
  description: t(
    'Defines the grouping of entities. ' +
      'Each series is shown as a specific color on the chart and ' +
      'has a legend toggle',
  ),
};

export const dndEntity: typeof dndGroupByControl = {
  ...dndGroupByControl,
  label: t('Entity'),
  default: null,
  multi: false,
  validators: [validateNonEmpty],
  description: t('This defines the element to be plotted on the chart'),
};

export const dnd_adhoc_filters: SharedControlConfig<'DndFilterSelect'> = {
  type: 'DndFilterSelect',
  label: t('Filters'),
  default: null,
  description: '',
  mapStateToProps: ({ datasource, form_data }) => ({
    columns: datasource?.columns.filter(c => c.filterable) || [],
    savedMetrics: datasource?.metrics || [],
    // current active adhoc metrics
    selectedMetrics: form_data.metrics || (form_data.metric ? [form_data.metric] : []),
    datasource,
  }),
  provideFormDataToProps: true,
};

export const dnd_adhoc_metrics: SharedControlConfig<'DndMetricSelect'> = {
  type: 'DndMetricSelect',
  multi: true,
  label: t('Metrics'),
  validators: [validateNonEmpty],
  mapStateToProps: ({ datasource }) => ({
    columns: datasource ? datasource.columns : [],
    savedMetrics: datasource ? datasource.metrics : [],
    datasourceType: datasource?.type,
  }),
  description: t('One or many metrics to display'),
};

export const dnd_adhoc_metric: SharedControlConfig<'DndMetricSelect'> = {
  ...dnd_adhoc_metrics,
  multi: false,
  label: t('Metric'),
  description: t('Metric'),
};

export const dnd_sort_by: SharedControlConfig<'DndMetricSelect'> = {
  type: 'DndMetricSelect',
  label: t('Sort by'),
  default: null,
  description: t('Metric used to define the top series'),
  mapStateToProps: ({ datasource }) => ({
    columns: datasource?.columns || [],
    savedMetrics: datasource?.metrics || [],
    datasourceType: datasource?.type,
  }),
};

export const dnd_size: SharedControlConfig<'DndMetricSelect'> = {
  ...dnd_adhoc_metric,
  label: t('Bubble Size'),
  description: t('Metric used to calculate bubble size'),
};

export const dnd_x: SharedControlConfig<'DndMetricSelect'> = {
  ...dnd_adhoc_metric,
  label: t('X Axis'),
  description: t('Metric assigned to the [X] axis'),
};

export const dnd_y: SharedControlConfig<'DndMetricSelect'> = {
  ...dnd_adhoc_metric,
  label: t('Y Axis'),
  description: t('Metric assigned to the [Y] axis'),
};

export const dnd_secondary_metric: SharedControlConfig<'DndMetricSelect'> = {
  ...dnd_adhoc_metric,
  label: t('Color Metric'),
  validators: [],
  description: t('A metric to use for color'),
};

export const dnd_granularity_sqla: typeof dndGroupByControl = {
  ...dndSeries,
  label: TIME_FILTER_LABELS.granularity_sqla,
  description: t(
    'The time column for the visualization. Note that you ' +
      'can define arbitrary expression that return a DATETIME ' +
      'column in the table. Also note that the ' +
      'filter below is applied against this column or ' +
      'expression',
  ),
  canDelete: false,
  ghostButtonText: t('Drop temporal column'),
  mapStateToProps: ({ datasource }) => {
    const temporalColumns = datasource?.columns.filter(c => c.is_dttm) ?? [];
    const options = Object.fromEntries(temporalColumns.map(option => [option.column_name, option]));
    return {
      options,
      default: datasource?.main_dttm_col || temporalColumns[0]?.column_name || null,
    };
  },
};

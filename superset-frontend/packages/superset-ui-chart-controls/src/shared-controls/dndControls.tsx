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
import {
  FeatureFlag,
  isFeatureEnabled,
  QueryColumn,
  QueryResponse,
  t,
  validateNonEmpty,
} from '@superset-ui/core';
import { ExtraControlProps, SharedControlConfig, Dataset } from '../types';
import { DATASET_TIME_COLUMN_OPTION, TIME_FILTER_LABELS } from '../constants';
import { QUERY_TIME_COLUMN_OPTION, defineSavedMetrics } from '..';

export const dndGroupByControl: SharedControlConfig<'DndColumnSelect'> = {
  type: 'DndColumnSelect',
  label: t('Dimensions'),
  default: [],
  description: t(
    'One or many columns to group by. High cardinality groupings should include a series limit ' +
      'to limit the number of fetched and rendered series.',
  ),
  mapStateToProps(state, { includeTime }) {
    const newState: ExtraControlProps = {};
    const { datasource } = state;
    if (datasource?.columns[0]?.hasOwnProperty('groupby')) {
      const options = (datasource as Dataset).columns.filter(c => c.groupby);
      if (includeTime) {
        options.unshift(DATASET_TIME_COLUMN_OPTION);
      }
      newState.options = Object.fromEntries(
        options.map(option => [option.column_name, option]),
      );
      newState.savedMetrics = (datasource as Dataset).metrics || [];
    } else {
      const options = datasource?.columns;
      if (includeTime) {
        (options as QueryColumn[])?.unshift(QUERY_TIME_COLUMN_OPTION);
      }
      newState.options = Object.fromEntries(
        (options as QueryColumn[])?.map(option => [option.name, option]),
      );
      newState.options = datasource?.columns;
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
  label: t('Dimensions'),
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
  default: [],
  description: '',
  mapStateToProps: ({ datasource, form_data }) => ({
    columns: datasource?.columns[0]?.hasOwnProperty('filterable')
      ? (datasource as Dataset)?.columns.filter(c => c.filterable)
      : datasource?.columns || [],
    savedMetrics: defineSavedMetrics(datasource),
    // current active adhoc metrics
    selectedMetrics:
      form_data.metrics || (form_data.metric ? [form_data.metric] : []),
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
    columns: datasource?.columns || [],
    savedMetrics: defineSavedMetrics(datasource),
    datasource,
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

export const dnd_adhoc_metric_2: SharedControlConfig<'DndMetricSelect'> = {
  ...dnd_adhoc_metric,
  label: t('Right Axis Metric'),
  description: t('Choose a metric for right axis'),
};

export const dnd_sort_by: SharedControlConfig<'DndMetricSelect'> = {
  type: 'DndMetricSelect',
  label: t('Sort by'),
  default: null,
  description: t(
    'Metric used to define how the top series are sorted if a series or row limit is present. ' +
      'If undefined reverts to the first metric (where appropriate).',
  ),
  mapStateToProps: ({ datasource }) => ({
    columns: datasource?.columns || [],
    savedMetrics: defineSavedMetrics(datasource),
    datasource,
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
  ghostButtonText: t(
    isFeatureEnabled(FeatureFlag.ENABLE_DND_WITH_CLICK_UX)
      ? 'Drop a temporal column here or click'
      : 'Drop temporal column here',
  ),
  mapStateToProps: ({ datasource }) => {
    if (datasource?.columns[0]?.hasOwnProperty('column_name')) {
      const temporalColumns =
        (datasource as Dataset)?.columns?.filter(c => c.is_dttm) ?? [];
      const options = Object.fromEntries(
        temporalColumns.map(option => [option.column_name, option]),
      );
      return {
        options,
        default:
          (datasource as Dataset)?.main_dttm_col ||
          temporalColumns[0]?.column_name ||
          null,
        isTemporal: true,
      };
    }

    const sortedQueryColumns = (datasource as QueryResponse)?.columns?.sort(
      query => (query?.is_dttm ? -1 : 1),
    );
    const options = Object.fromEntries(
      sortedQueryColumns.map(option => [option.name, option]),
    );
    return {
      options,
      default: sortedQueryColumns[0]?.name || null,
      isTemporal: true,
    };
  },
};

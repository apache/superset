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
import { QueryColumn, t, validateNonEmpty } from '@superset-ui/core';
import {
  ExtraControlProps,
  SharedControlConfig,
  Dataset,
  Metric,
  isDataset,
} from '../types';
import { DATASET_TIME_COLUMN_OPTION, TIME_FILTER_LABELS } from '../constants';
import {
  QUERY_TIME_COLUMN_OPTION,
  defineSavedMetrics,
  ColumnOption,
  ColumnMeta,
  FilterOption,
  temporalColumnMixin,
  datePickerInAdhocFilterMixin,
  xAxisMixin,
} from '..';

type Control = {
  savedMetrics?: Metric[] | null;
  default?: unknown;
};

/*
 * Note: Previous to the commit that introduced this comment, the shared controls module
 * would check feature flags at module execution time and expose a different control
 * configuration (component + props) depending on the status of drag-and-drop feature
 * flags.  This commit combines those configs, merging the required props for both the
 * drag-and-drop and non-drag-and-drop components, and renders a wrapper component that
 * checks feature flags at component render time to avoid race conditions between when
 * feature flags are set and when they're checked.
 */

export const dndGroupByControl: SharedControlConfig<
  'DndColumnSelect' | 'SelectControl',
  ColumnMeta
> = {
  type: 'DndColumnSelect',
  label: t('Dimensions'),
  multi: true,
  freeForm: true,
  clearable: true,
  default: [],
  includeTime: false,
  description: t(
    'Dimensions contain qualitative values such as names, dates, or geographical data. ' +
      'Use dimensions to categorize, segment, and reveal the details in your data. ' +
      'Dimensions affect the level of detail in the view.',
  ),
  optionRenderer: (c: ColumnMeta) => <ColumnOption showType column={c} />,
  valueRenderer: (c: ColumnMeta) => <ColumnOption column={c} />,
  valueKey: 'column_name',
  allowAll: true,
  filterOption: ({ data: opt }: FilterOption<ColumnMeta>, text: string) =>
    opt.column_name?.toLowerCase().includes(text.toLowerCase()) ||
    opt.verbose_name?.toLowerCase().includes(text.toLowerCase()) ||
    false,
  promptTextCreator: (label: unknown) => label,
  mapStateToProps(state, controlState) {
    const newState: ExtraControlProps = {};
    const { datasource } = state;
    if (datasource?.columns[0]?.hasOwnProperty('groupby')) {
      const options = (datasource as Dataset).columns.filter(c => c.groupby);
      if (controlState?.includeTime) {
        options.unshift(DATASET_TIME_COLUMN_OPTION);
      }
      newState.options = options;
      newState.savedMetrics = (datasource as Dataset).metrics || [];
    } else {
      const options = (datasource?.columns as QueryColumn[]) || [];
      if (controlState?.includeTime) {
        options.unshift(QUERY_TIME_COLUMN_OPTION);
      }
      newState.options = options;
    }
    return newState;
  },
  commaChoosesOption: false,
};

export const dndColumnsControl: typeof dndGroupByControl = {
  ...dndGroupByControl,
  label: t('Columns'),
  description: t('Add dataset columns here to group the pivot table columns.'),
};

export const dndSeriesControl: typeof dndGroupByControl = {
  ...dndGroupByControl,
  label: t('Dimension'),
  multi: false,
  default: null,
  description: t(
    'Defines the grouping of entities. ' +
      'Each series is represented by a specific color in the chart.',
  ),
};

export const dndEntityControl: typeof dndGroupByControl = {
  ...dndGroupByControl,
  label: t('Entity'),
  default: null,
  multi: false,
  validators: [validateNonEmpty],
  description: t('This defines the element to be plotted on the chart'),
};

export const dndAdhocFilterControl: SharedControlConfig<
  'DndFilterSelect' | 'AdhocFilterControl'
> = {
  type: 'DndFilterSelect',
  label: t('Filters'),
  default: [],
  description: '',
  mapStateToProps: ({ datasource, form_data }) => ({
    columns: isDataset(datasource)
      ? datasource.columns.filter(c => c.filterable)
      : datasource?.columns || [],
    savedMetrics: defineSavedMetrics(datasource),
    // current active adhoc metrics
    selectedMetrics:
      form_data.metrics || (form_data.metric ? [form_data.metric] : []),
    datasource,
  }),
  provideFormDataToProps: true,
  ...datePickerInAdhocFilterMixin,
};

export const dndAdhocMetricsControl: SharedControlConfig<
  'DndMetricSelect' | 'MetricsControl'
> = {
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
  description: t(
    'Select one or many metrics to display. ' +
      'You can use an aggregation function on a column ' +
      'or write custom SQL to create a metric.',
  ),
};

export const dndAdhocMetricControl: typeof dndAdhocMetricsControl = {
  ...dndAdhocMetricsControl,
  multi: false,
  label: t('Metric'),
  description: t(
    'Select a metric to display. ' +
      'You can use an aggregation function on a column ' +
      'or write custom SQL to create a metric.',
  ),
};

export const dndAdhocMetricControl2: typeof dndAdhocMetricControl = {
  ...dndAdhocMetricControl,
  label: t('Right Axis Metric'),
  clearable: true,
  description: t('Select a metric to display on the right axis'),
};

export const dndSortByControl: SharedControlConfig<
  'DndMetricSelect' | 'MetricsControl'
> = {
  type: 'DndMetricSelect',
  label: t('Sort query by'),
  default: null,
  description: t(
    'Orders the query result that generates the source data for this chart. ' +
      'If a series or row limit is reached, this determines what data are truncated. ' +
      'If undefined, defaults to the first metric (where appropriate).',
  ),
  mapStateToProps: ({ datasource }) => ({
    columns: datasource?.columns || [],
    savedMetrics: defineSavedMetrics(datasource),
    datasource,
    datasourceType: datasource?.type,
  }),
};

export const dndSizeControl: typeof dndAdhocMetricControl = {
  ...dndAdhocMetricControl,
  label: t('Bubble Size'),
  description: t('Metric used to calculate bubble size'),
  default: null,
};

export const dndXControl: typeof dndAdhocMetricControl = {
  ...dndAdhocMetricControl,
  label: t('X Axis'),
  description: t(
    "The dataset column/metric that returns the values on your chart's x-axis.",
  ),
  default: null,
};

export const dndYControl: typeof dndAdhocMetricControl = {
  ...dndAdhocMetricControl,
  label: t('Y Axis'),
  description: t(
    "The dataset column/metric that returns the values on your chart's y-axis.",
  ),
  default: null,
};

export const dndSecondaryMetricControl: typeof dndAdhocMetricControl = {
  ...dndAdhocMetricControl,
  label: t('Color Metric'),
  default: null,
  validators: [],
  description: t('A metric to use for color'),
};

export const dndGranularitySqlaControl: typeof dndSeriesControl = {
  ...dndSeriesControl,
  ...temporalColumnMixin,
  label: TIME_FILTER_LABELS.granularity_sqla,
  description: t(
    'The time column for the visualization. Note that you ' +
      'can define arbitrary expression that return a DATETIME ' +
      'column in the table. Also note that the ' +
      'filter below is applied against this column or ' +
      'expression',
  ),
  default: (c: Control) => c.default,
  clearable: false,
  canDelete: false,
  ghostButtonText: t('Drop a temporal column here or click'),
  optionRenderer: (c: ColumnMeta) => <ColumnOption showType column={c} />,
  valueRenderer: (c: ColumnMeta) => <ColumnOption column={c} />,
  valueKey: 'column_name',
};

export const dndXAxisControl: typeof dndGroupByControl = {
  ...dndGroupByControl,
  ...xAxisMixin,
};

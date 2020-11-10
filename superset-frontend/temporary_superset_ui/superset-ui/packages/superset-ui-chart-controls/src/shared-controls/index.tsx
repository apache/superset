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

/**
 * This file exports all controls available for use in chart plugins internal to Superset.
 * It is not recommended to use the controls here for any third-party plugins.
 *
 * While the React components located in `controls/components` represent different
 * types of controls (CheckboxControl, SelectControl, TextControl, ...), the controls here
 * represent instances of control types, that can be reused across visualization types.
 *
 * When controls are reused across viz types, their values are carried over as a user
 * changes the chart types.
 *
 * While the keys defined in the control itself get passed to the controlType as props,
 * here's a list of the keys that are common to all controls, and as a result define the
 * control interface.
 */
import React from 'react';
import {
  t,
  getCategoricalSchemeRegistry,
  getSequentialSchemeRegistry,
  SequentialScheme,
  legacyValidateInteger,
  validateNonEmpty,
} from '@superset-ui/core';

import { mainMetric, formatSelectOptions } from '../utils';
import { TIME_FILTER_LABELS } from '../constants';
import {
  Metric,
  SharedControlConfig,
  ColumnMeta,
  ExtraControlProps,
  SelectControlConfig,
} from '../types';
import { ColumnOption } from '../components/ColumnOption';

const categoricalSchemeRegistry = getCategoricalSchemeRegistry();
const sequentialSchemeRegistry = getSequentialSchemeRegistry();

export const PRIMARY_COLOR = { r: 0, g: 122, b: 135, a: 1 };

// input choices & options
export const D3_FORMAT_OPTIONS = [
  ['SMART_NUMBER', 'Adaptative formating'],
  ['~g', 'Original value'],
  [',d', ',d (12345.432 => 12,345)'],
  ['.1s', '.1s (12345.432 => 10k)'],
  ['.3s', '.3s (12345.432 => 12.3k)'],
  [',.1%', ',.1% (12345.432 => 1,234,543.2%)'],
  ['.3%', '.3% (12345.432 => 1234543.200%)'],
  ['.4r', '.4r (12345.432 => 12350)'],
  [',.3f', ',.3f (12345.432 => 12,345.432)'],
  ['+,', '+, (12345.432 => +12,345.432)'],
  ['$,.2f', '$,.2f (12345.432 => $12,345.43)'],
  ['DURATION', 'Duration in ms (66000 => 1m 6s)'],
  ['DURATION_SUB', 'Duration in ms (100.40008 => 100ms 400µs 80ns)'],
];

const ROW_LIMIT_OPTIONS = [10, 50, 100, 250, 500, 1000, 5000, 10000, 50000];
const SERIES_LIMITS = [0, 5, 10, 25, 50, 100, 500];

export const D3_FORMAT_DOCS = t('D3 format syntax: https://github.com/d3/d3-format');

export const D3_TIME_FORMAT_OPTIONS = [
  ['smart_date', t('Adaptative formating')],
  ['%d/%m/%Y', '%d/%m/%Y | 14/01/2019'],
  ['%m/%d/%Y', '%m/%d/%Y | 01/14/2019'],
  ['%Y-%m-%d', '%Y-%m-%d | 2019-01-14'],
  ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M:%S | 2019-01-14 01:32:10'],
  ['%d-%m-%Y %H:%M:%S', '%Y-%m-%d %H:%M:%S | 14-01-2019 01:32:10'],
  ['%H:%M:%S', '%H:%M:%S | 01:32:10'],
];

const timeColumnOption = {
  verbose_name: 'Time',
  column_name: '__timestamp',
  description: t('A reference to the [Time] configuration, taking granularity into account'),
};

type Control = {
  savedMetrics?: Metric[] | null;
  default?: unknown;
};

const groupByControl: SharedControlConfig<'SelectControl', ColumnMeta> = {
  type: 'SelectControl',
  label: t('Group by'),
  queryField: 'groupby',
  multi: true,
  freeForm: true,
  clearable: true,
  default: [],
  includeTime: false,
  description: t('One or many columns to group by'),
  optionRenderer: c => <ColumnOption showType column={c} />,
  valueRenderer: c => <ColumnOption column={c} />,
  valueKey: 'column_name',
  allowAll: true,
  filterOption: ({ data: opt }, text: string) =>
    (opt.column_name && opt.column_name.toLowerCase().includes(text.toLowerCase())) ||
    (opt.verbose_name && opt.verbose_name.toLowerCase().includes(text.toLowerCase())) ||
    false,
  promptTextCreator: (label: unknown) => label,
  mapStateToProps(state, { includeTime }) {
    const newState: ExtraControlProps = {};
    if (state.datasource) {
      const options = state.datasource.columns.filter(c => c.groupby);
      if (includeTime) {
        options.push(timeColumnOption);
      }
      newState.options = options;
    }
    return newState;
  },
  commaChoosesOption: false,
};

const metrics: SharedControlConfig<'MetricsControl'> = {
  type: 'MetricsControl',
  queryField: 'metrics',
  multi: true,
  label: t('Metrics'),
  validators: [validateNonEmpty],
  default: (c: Control) => {
    const metric = mainMetric(c.savedMetrics);
    return metric ? [metric] : null;
  },
  mapStateToProps: ({ datasource }) => {
    return {
      columns: datasource ? datasource.columns : [],
      savedMetrics: datasource ? datasource.metrics : [],
      datasourceType: datasource?.type,
    };
  },
  description: t('One or many metrics to display'),
};

const metric: SharedControlConfig<'MetricsControl'> = {
  ...metrics,
  multi: false,
  label: t('Metric'),
  description: t('Metric'),
  default: (c: Control) => mainMetric(c.savedMetrics),
};

const datasourceControl: SharedControlConfig<'DatasourceControl'> = {
  type: 'DatasourceControl',
  label: t('Datasource'),
  default: null,
  description: null,
  mapStateToProps: ({ datasource }) => {
    return {
      datasource,
    };
  },
};

const viz_type: SharedControlConfig<'VizTypeControl'> = {
  type: 'VizTypeControl',
  label: t('Visualization Type'),
  default: 'table',
  description: t('The type of visualization to display'),
};

const color_picker: SharedControlConfig<'ColorPickerControl'> = {
  type: 'ColorPickerControl',
  label: t('Fixed Color'),
  description: t('Use this to define a static color for all circles'),
  default: PRIMARY_COLOR,
  renderTrigger: true,
};

const metric_2: SharedControlConfig<'MetricsControl'> = {
  ...metric,
  label: t('Right Axis Metric'),
  clearable: true,
  description: t('Choose a metric for right axis'),
};

const linear_color_scheme: SharedControlConfig<'ColorSchemeControl'> = {
  type: 'ColorSchemeControl',
  label: t('Linear Color Scheme'),
  choices: () =>
    (sequentialSchemeRegistry.values() as SequentialScheme[]).map(value => [value.id, value.label]),
  default: sequentialSchemeRegistry.getDefaultKey(),
  clearable: false,
  description: '',
  renderTrigger: true,
  schemes: () => sequentialSchemeRegistry.getMap(),
  isLinear: true,
};

const secondary_metric: SharedControlConfig<'MetricsControl'> = {
  ...metric,
  label: t('Color Metric'),
  default: null,
  validators: [],
  description: t('A metric to use for color'),
};

const columnsControl: typeof groupByControl = {
  ...groupByControl,
  label: t('Columns'),
  description: t('One or many columns to pivot as columns'),
};

const druid_time_origin: SharedControlConfig<'SelectControl'> = {
  type: 'SelectControl',
  freeForm: true,
  label: TIME_FILTER_LABELS.druid_time_origin,
  choices: [
    ['', 'default'],
    ['now', 'now'],
  ],
  default: null,
  description: t(
    'Defines the origin where time buckets start, ' +
      'accepts natural dates as in `now`, `sunday` or `1970-01-01`',
  ),
};

const granularity: SharedControlConfig<'SelectControl'> = {
  type: 'SelectControl',
  freeForm: true,
  label: TIME_FILTER_LABELS.granularity,
  default: 'one day',
  choices: [
    [null, 'all'],
    ['PT5S', '5 seconds'],
    ['PT30S', '30 seconds'],
    ['PT1M', '1 minute'],
    ['PT5M', '5 minutes'],
    ['PT30M', '30 minutes'],
    ['PT1H', '1 hour'],
    ['PT6H', '6 hour'],
    ['P1D', '1 day'],
    ['P7D', '7 days'],
    ['P1W', 'week'],
    ['week_starting_sunday', 'week starting Sunday'],
    ['week_ending_saturday', 'week ending Saturday'],
    ['P1M', 'month'],
    ['P3M', 'quarter'],
    ['P1Y', 'year'],
  ],
  description: t(
    'The time granularity for the visualization. Note that you ' +
      'can type and use simple natural language as in `10 seconds`, ' +
      '`1 day` or `56 weeks`',
  ),
};

const granularity_sqla: SharedControlConfig<'SelectControl', ColumnMeta> = {
  type: 'SelectControl',
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
  optionRenderer: c => <ColumnOption showType column={c} />,
  valueRenderer: c => <ColumnOption column={c} />,
  valueKey: 'column_name',
  mapStateToProps: state => {
    const props: Partial<SelectControlConfig<ColumnMeta>> = {};
    if (state.datasource) {
      props.options = state.datasource.columns.filter(c => c.is_dttm);
      props.default = null;
      if (state.datasource.main_dttm_col) {
        props.default = state.datasource.main_dttm_col;
      } else if (props.options && props.options.length > 0) {
        props.default = props.options[0].column_name;
      }
    }
    return props;
  },
};

const time_grain_sqla: SharedControlConfig<'SelectControl'> = {
  type: 'SelectControl',
  label: TIME_FILTER_LABELS.time_grain_sqla,
  default: 'P1D',
  description: t(
    'The time granularity for the visualization. This ' +
      'applies a date transformation to alter ' +
      'your time column and defines a new time granularity. ' +
      'The options here are defined on a per database ' +
      'engine basis in the Superset source code.',
  ),
  mapStateToProps: ({ datasource }) => ({
    choices: datasource?.time_grain_sqla || null,
  }),
};

const time_range: SharedControlConfig<'DateFilterControl'> = {
  type: 'DateFilterControl',
  freeForm: true,
  label: TIME_FILTER_LABELS.time_range,
  default: t('Last week'), // this value is translated, but the backend wouldn't understand a translated value?
  description: t(
    'The time range for the visualization. All relative times, e.g. "Last month", ' +
      '"Last 7 days", "now", etc. are evaluated on the server using the server\'s ' +
      'local time (sans timezone). All tooltips and placeholder times are expressed ' +
      'in UTC (sans timezone). The timestamps are then evaluated by the database ' +
      "using the engine's local timezone. Note one can explicitly set the timezone " +
      'per the ISO 8601 format if specifying either the start and/or end time.',
  ),
  mapStateToProps: ({ form_data }) => ({
    endpoints: form_data?.time_range_endpoints || null,
  }),
};

const row_limit: SharedControlConfig<'SelectControl'> = {
  type: 'SelectControl',
  freeForm: true,
  label: t('Row limit'),
  validators: [legacyValidateInteger],
  default: 10000,
  choices: formatSelectOptions(ROW_LIMIT_OPTIONS),
};

const limit: SharedControlConfig<'SelectControl'> = {
  type: 'SelectControl',
  freeForm: true,
  label: t('Series limit'),
  validators: [legacyValidateInteger],
  choices: formatSelectOptions(SERIES_LIMITS),
  description: t(
    'Limits the number of time series that get displayed. A sub query ' +
      '(or an extra phase where sub queries are not supported) is applied to limit ' +
      'the number of time series that get fetched and displayed. This feature is useful ' +
      'when grouping by high cardinality dimension(s).',
  ),
};

const timeseries_limit_metric: SharedControlConfig<'MetricsControl'> = {
  type: 'MetricsControl',
  label: t('Sort By'),
  default: null,
  description: t('Metric used to define the top series'),
  mapStateToProps: ({ datasource }) => ({
    columns: datasource?.columns || [],
    savedMetrics: datasource?.metrics || [],
    datasourceType: datasource?.type,
  }),
};

const series: typeof groupByControl = {
  ...groupByControl,
  label: t('Series'),
  multi: false,
  default: null,
  description: t(
    'Defines the grouping of entities. ' +
      'Each series is shown as a specific color on the chart and ' +
      'has a legend toggle',
  ),
};

const entity: typeof groupByControl = {
  ...groupByControl,
  label: t('Entity'),
  default: null,
  multi: false,
  validators: [validateNonEmpty],
  description: t('This defines the element to be plotted on the chart'),
};

const x: SharedControlConfig<'MetricsControl'> = {
  ...metric,
  label: t('X Axis'),
  description: t('Metric assigned to the [X] axis'),
  default: null,
};

const y: SharedControlConfig<'MetricsControl'> = {
  ...metric,
  label: t('Y Axis'),
  default: null,
  description: t('Metric assigned to the [Y] axis'),
};

const size: SharedControlConfig<'MetricsControl'> = {
  ...metric,
  label: t('Bubble Size'),
  default: null,
};

const y_axis_format: SharedControlConfig<'SelectControl'> = {
  type: 'SelectControl',
  freeForm: true,
  label: t('Y Axis Format'),
  renderTrigger: true,
  default: 'SMART_NUMBER',
  choices: D3_FORMAT_OPTIONS,
  description: D3_FORMAT_DOCS,
  mapStateToProps: state => {
    const showWarning = state.controls?.comparison_type?.value === 'percentage';
    return {
      warning: showWarning
        ? t(
            'When `Calculation type` is set to "Percentage change", the Y ' +
              'Axis Format is forced to `.1%`',
          )
        : null,
      disabled: showWarning,
    };
  },
};

const adhoc_filters: SharedControlConfig<'AdhocFilterControl'> = {
  type: 'AdhocFilterControl',
  label: t('Filters'),
  default: null,
  description: '',
  mapStateToProps: ({ datasource }) => ({
    columns: datasource?.columns.filter(c => c.filterable) || [],
    savedMetrics: datasource?.metrics || [],
    datasource,
  }),
  provideFormDataToProps: true,
};

const color_scheme: SharedControlConfig<'ColorSchemeControl'> = {
  type: 'ColorSchemeControl',
  label: t('Color Scheme'),
  default: categoricalSchemeRegistry.getDefaultKey(),
  renderTrigger: true,
  choices: () => categoricalSchemeRegistry.keys().map(s => [s, s]),
  description: t('The color scheme for rendering chart'),
  schemes: () => categoricalSchemeRegistry.getMap(),
};

const label_colors: SharedControlConfig<'ColorMapControl'> = {
  type: 'ColorMapControl',
  label: t('Color Map'),
  default: {},
  renderTrigger: true,
  mapStateToProps: ({
    form_data: { color_namespace: colorNamespace, color_scheme: colorScheme },
  }) => ({
    colorNamespace,
    colorScheme,
  }),
};

const sharedControls = {
  metrics,
  metric,
  datasource: datasourceControl,
  viz_type,
  color_picker,
  metric_2,
  linear_color_scheme,
  secondary_metric,
  groupby: groupByControl,
  columns: columnsControl,
  druid_time_origin,
  granularity,
  granularity_sqla,
  time_grain_sqla,
  time_range,
  row_limit,
  limit,
  timeseries_limit_metric,
  series,
  entity,
  x,
  y,
  size,
  y_axis_format,
  adhoc_filters,
  color_scheme,
  label_colors,
};

export default sharedControls;

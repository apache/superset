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
 * This file exports all controls available for use in the different visualization types
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
 * control interface:
 *
 * - type: the control type, referencing a React component of the same name
 * - label: the label as shown in the control's header
 * - description: shown in the info tooltip of the control's header
 * - default: the default value when opening a new chart, or changing visualization type
 * - renderTrigger: a bool that defines whether the visualization should be re-rendered
     when changed. This should `true` for controls that only affect the rendering (client side)
     and don't affect the query or backend data processing as those require to re run a query
     and fetch the data
 * - validators: an array of functions that will receive the value of the component and
     should return error messages when the value is not valid. The error message gets
     bubbled up to the control header, section header and query panel header.
 * - warning: text shown as a tooltip on a warning icon in the control's header
 * - error: text shown as a tooltip on a error icon in the control's header
 * - mapStateToProps: a function that receives the App's state and return an object of k/v
     to overwrite configuration at runtime. This is useful to alter a component based on
     anything external to it, like another control's value. For instance it's possible to
     show a warning based on the value of another component. It's also possible to bind
     arbitrary data from the redux store to the component this way.
 * - tabOverride: set to 'data' if you want to force a renderTrigger to show up on the `Data`
     tab, otherwise `renderTrigger: true` components will show up on the `Style` tab.
 *
 * Note that the keys defined in controls in this file that are not listed above represent
 * props specific for the React component defined as `type`. Also note that this module work
 * in tandem with `controlPanels/index.js` that defines how controls are composed into sections for
 * each and every visualization type.
 */
import {
  t,
  getCategoricalSchemeRegistry,
  getSequentialSchemeRegistry,
  legacyValidateInteger,
  validateNonEmpty,
} from '@superset-ui/core';
import { formatSelectOptions } from 'src/explore/exploreUtils';
import { TIME_FILTER_LABELS } from './constants';
import { StyledColumnOption } from './components/optionRenderers';

const categoricalSchemeRegistry = getCategoricalSchemeRegistry();
const sequentialSchemeRegistry = getSequentialSchemeRegistry();

export const PRIMARY_COLOR = { r: 0, g: 122, b: 135, a: 1 };

// input choices & options
export const D3_FORMAT_OPTIONS = [
  ['SMART_NUMBER', t('Adaptive formatting')],
  ['~g', t('Original value')],
  [',d', ',d (12345.432 => 12,345)'],
  ['.1s', '.1s (12345.432 => 10k)'],
  ['.3s', '.3s (12345.432 => 12.3k)'],
  [',.1%', ',.1% (12345.432 => 1,234,543.2%)'],
  ['.3%', '.3% (12345.432 => 1234543.200%)'],
  ['.4r', '.4r (12345.432 => 12350)'],
  [',.3f', ',.3f (12345.432 => 12,345.432)'],
  ['+,', '+, (12345.432 => +12,345.432)'],
  ['$,.2f', '$,.2f (12345.432 => $12,345.43)'],
  ['DURATION', t('Duration in ms (66000 => 1m 6s)')],
  ['DURATION_SUB', t('Duration in ms (100.40008 => 100ms 400µs 80ns)')],
];

const ROW_LIMIT_OPTIONS = [10, 50, 100, 250, 500, 1000, 5000, 10000, 50000];

const SERIES_LIMITS = [5, 10, 25, 50, 100, 500];

export const D3_FORMAT_DOCS =
  'D3 format syntax: https://github.com/d3/d3-format';

export const D3_TIME_FORMAT_OPTIONS = [
  ['smart_date', t('Adaptive formatting')],
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
  description: t(
    'A reference to the [Time] configuration, taking granularity into ' +
      'account',
  ),
};

const groupByControl = {
  type: 'SelectControl',
  multi: true,
  freeForm: true,
  label: t('Dimensions'),
  default: [],
  includeTime: false,
  description: t(
    'One or many columns to group by. High cardinality groupings should include a series limit ' +
      'to limit the number of fetched and rendered series.',
  ),
  optionRenderer: c => <StyledColumnOption column={c} showType />,
  valueKey: 'column_name',
  filterOption: ({ data: opt }, text) =>
    (opt.column_name &&
      opt.column_name.toLowerCase().indexOf(text.toLowerCase()) >= 0) ||
    (opt.verbose_name &&
      opt.verbose_name.toLowerCase().indexOf(text.toLowerCase()) >= 0),
  mapStateToProps: (state, control) => {
    const newState = {};
    if (state.datasource) {
      newState.options = state.datasource.columns.filter(c => c.groupby);
      if (control && control.includeTime) {
        newState.options.push(timeColumnOption);
      }
    }
    return newState;
  },
};

const metrics = {
  type: 'MetricsControl',
  multi: true,
  label: t('Metrics'),
  validators: [validateNonEmpty],
  mapStateToProps: state => {
    const { datasource } = state;
    return {
      columns: datasource ? datasource.columns : [],
      savedMetrics: datasource ? datasource.metrics : [],
      datasource,
    };
  },
  description: t('One or many metrics to display'),
};
const metric = {
  ...metrics,
  multi: false,
  label: t('Metric'),
  description: t('Metric'),
};

export function columnChoices(datasource) {
  if (datasource && datasource.columns) {
    return datasource.columns
      .map(col => [col.column_name, col.verbose_name || col.column_name])
      .sort((opt1, opt2) =>
        opt1[1].toLowerCase() > opt2[1].toLowerCase() ? 1 : -1,
      );
  }
  return [];
}

export const controls = {
  metrics,

  metric,

  datasource: {
    type: 'DatasourceControl',
    label: t('Dataset'),
    default: null,
    description: null,
    mapStateToProps: ({ datasource }) => ({
      datasource,
      isEditable: !!datasource,
    }),
  },

  viz_type: {
    type: 'VizTypeControl',
    default: 'table',
    description: t('The type of visualization to display'),
  },

  color_picker: {
    label: t('Fixed color'),
    description: t('Use this to define a static color for all circles'),
    type: 'ColorPickerControl',
    default: PRIMARY_COLOR,
    renderTrigger: true,
  },

  metric_2: {
    ...metric,
    label: t('Right axis metric'),
    clearable: true,
    description: t('Choose a metric for right axis'),
  },

  linear_color_scheme: {
    type: 'ColorSchemeControl',
    label: t('Linear color scheme'),
    choices: () =>
      sequentialSchemeRegistry.values().map(value => [value.id, value.label]),
    default: sequentialSchemeRegistry.getDefaultKey(),
    clearable: false,
    description: '',
    renderTrigger: true,
    schemes: () => sequentialSchemeRegistry.getMap(),
    isLinear: true,
  },

  secondary_metric: {
    ...metric,
    label: t('Color metric'),
    default: null,
    validators: [],
    description: t('A metric to use for color'),
  },

  groupby: groupByControl,

  columns: {
    ...groupByControl,
    label: t('Columns'),
    description: t('One or many controls to pivot as columns'),
  },

  granularity: {
    type: 'SelectControl',
    freeForm: true,
    label: TIME_FILTER_LABELS.granularity,
    default: 'P1D',
    choices: [
      [null, t('all')],
      ['PT5S', t('5 seconds')],
      ['PT30S', t('30 seconds')],
      ['PT1M', t('1 minute')],
      ['PT5M', t('5 minutes')],
      ['PT30M', t('30 minutes')],
      ['PT1H', t('1 hour')],
      ['PT6H', t('6 hour')],
      ['P1D', t('1 day')],
      ['P7D', t('7 days')],
      ['P1W', t('week')],
      ['week_starting_sunday', t('week starting Sunday')],
      ['week_ending_saturday', t('week ending Saturday')],
      ['P1M', t('month')],
      ['P3M', t('quarter')],
      ['P1Y', t('year')],
    ],
    description: t(
      'The time granularity for the visualization. Note that you ' +
        'can type and use simple natural language as in `10 seconds`,' +
        '`1 day` or `56 weeks`',
    ),
  },

  granularity_sqla: {
    type: 'SelectControl',
    label: TIME_FILTER_LABELS.granularity_sqla,
    description: t(
      'The time column for the visualization. Note that you ' +
        'can define arbitrary expression that return a DATETIME ' +
        'column in the table. Also note that the ' +
        'filter below is applied against this column or ' +
        'expression',
    ),
    clearable: false,
    optionRenderer: c => <StyledColumnOption column={c} showType />,
    valueKey: 'column_name',
    mapStateToProps: state => {
      const props = {};
      if (state.datasource) {
        props.choices = state.datasource.granularity_sqla;
        props.default = null;
        if (state.datasource.main_dttm_col) {
          props.default = state.datasource.main_dttm_col;
        } else if (props.choices && props.choices.length > 0) {
          props.default = props.choices[0].column_name;
        }
      }
      return props;
    },
  },

  time_grain_sqla: {
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
    mapStateToProps: state => ({
      choices: state.datasource ? state.datasource.time_grain_sqla : null,
    }),
  },

  time_range: {
    type: 'DateFilterControl',
    freeForm: true,
    label: TIME_FILTER_LABELS.time_range,
    default: t('No filter'), // this value is translated, but the backend wouldn't understand a translated value?
    description: t(
      'The time range for the visualization. All relative times, e.g. "Last month", ' +
        '"Last 7 days", "now", etc. are evaluated on the server using the server\'s ' +
        'local time (sans timezone). All tooltips and placeholder times are expressed ' +
        'in UTC (sans timezone). The timestamps are then evaluated by the database ' +
        "using the engine's local timezone. Note one can explicitly set the timezone " +
        'per the ISO 8601 format if specifying either the start and/or end time.',
    ),
  },

  row_limit: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Row limit'),
    validators: [legacyValidateInteger],
    default: 10000,
    choices: formatSelectOptions(ROW_LIMIT_OPTIONS),
    description: t('Limits the number of rows that get displayed.'),
  },

  limit: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Series limit'),
    validators: [legacyValidateInteger],
    choices: formatSelectOptions(SERIES_LIMITS),
    clearable: true,
    description: t(
      'Limits the number of series that get displayed. A joined subquery (or an extra phase ' +
        'where subqueries are not supported) is applied to limit the number of series that get ' +
        'fetched and rendered. This feature is useful when grouping by high cardinality ' +
        'column(s) though does increase the query complexity and cost.',
    ),
  },

  timeseries_limit_metric: {
    type: 'MetricsControl',
    label: t('Sort by'),
    default: null,
    clearable: true,
    description: t(
      'Metric used to define how the top series are sorted if a series or row limit is present. ' +
        'If undefined reverts to the first metric (where appropriate).',
    ),
    mapStateToProps: state => ({
      columns: state.datasource ? state.datasource.columns : [],
      savedMetrics: state.datasource ? state.datasource.metrics : [],
      datasource: state.datasource,
    }),
  },

  series: {
    ...groupByControl,
    label: t('Dimensions'),
    multi: false,
    default: null,
    description: t(
      'Defines the grouping of entities. ' +
        'Each series is shown as a specific color on the chart and ' +
        'has a legend toggle',
    ),
  },

  entity: {
    ...groupByControl,
    label: t('Entity'),
    default: null,
    multi: false,
    validators: [validateNonEmpty],
    description: t('This defines the element to be plotted on the chart'),
  },

  x: {
    ...metric,
    label: t('X Axis'),
    description: t('Metric assigned to the [X] axis'),
    default: null,
  },

  y: {
    ...metric,
    label: t('Y Axis'),
    default: null,
    description: t('Metric assigned to the [Y] axis'),
  },

  size: {
    ...metric,
    label: t('Bubble size'),
    default: null,
  },

  y_axis_format: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Y Axis Format'),
    renderTrigger: true,
    default: 'SMART_NUMBER',
    choices: D3_FORMAT_OPTIONS,
    description: D3_FORMAT_DOCS,
    mapStateToProps: state => {
      const showWarning =
        state.controls &&
        state.controls.comparison_type &&
        state.controls.comparison_type.value === 'percentage';
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
  },

  adhoc_filters: {
    type: 'AdhocFilterControl',
    label: t('Filters'),
    default: null,
    description: '',
    mapStateToProps: state => ({
      columns: state.datasource
        ? state.datasource.columns.filter(c => c.filterable)
        : [],
      savedMetrics: state.datasource ? state.datasource.metrics : [],
      datasource: state.datasource,
    }),
  },

  color_scheme: {
    type: 'ColorSchemeControl',
    label: t('Color scheme'),
    default: categoricalSchemeRegistry.getDefaultKey(),
    renderTrigger: true,
    choices: () => categoricalSchemeRegistry.keys().map(s => [s, s]),
    description: t('The color scheme for rendering chart'),
    schemes: () => categoricalSchemeRegistry.getMap(),
  },
};

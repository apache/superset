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
import React from 'react';
import { t } from '@superset-ui/translation';
import {
  getCategoricalSchemeRegistry,
  getSequentialSchemeRegistry,
} from '@superset-ui/color';
import {
  legacyValidateInteger,
  validateNonEmpty,
} from '@superset-ui/validator';

import {
  formatSelectOptionsForRange,
  formatSelectOptions,
  mainMetric,
} from '../modules/utils';
import ColumnOption from '../components/ColumnOption';
import { TIME_FILTER_LABELS } from './constants';

const categoricalSchemeRegistry = getCategoricalSchemeRegistry();
const sequentialSchemeRegistry = getSequentialSchemeRegistry();

export const PRIMARY_COLOR = { r: 0, g: 122, b: 135, a: 1 };

// input choices & options
export const D3_FORMAT_OPTIONS = [
  ['SMART_NUMBER', 'Adaptative formating'],
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

export const D3_FORMAT_DOCS =
  'D3 format syntax: https://github.com/d3/d3-format';

export const D3_TIME_FORMAT_OPTIONS = [
  ['smart_date', 'Adaptative formating'],
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
  label: t('Group by'),
  default: [],
  includeTime: false,
  description: t('One or many controls to group by'),
  optionRenderer: c => <ColumnOption column={c} showType />,
  valueRenderer: c => <ColumnOption column={c} />,
  valueKey: 'column_name',
  allowAll: true,
  filterOption: (opt, text) =>
    (opt.column_name &&
      opt.column_name.toLowerCase().indexOf(text.toLowerCase()) >= 0) ||
    (opt.verbose_name &&
      opt.verbose_name.toLowerCase().indexOf(text.toLowerCase()) >= 0),
  promptTextCreator: label => label,
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
  commaChoosesOption: false,
};

const metrics = {
  type: 'MetricsControl',
  multi: true,
  label: t('Metrics'),
  validators: [validateNonEmpty],
  default: c => {
    const metric = mainMetric(c.savedMetrics);
    return metric ? [metric] : null;
  },
  mapStateToProps: state => {
    const datasource = state.datasource;
    return {
      columns: datasource ? datasource.columns : [],
      savedMetrics: datasource ? datasource.metrics : [],
      datasourceType: datasource && datasource.type,
    };
  },
  description: t('One or many metrics to display'),
};
const metric = {
  ...metrics,
  multi: false,
  label: t('Metric'),
  description: t('Metric'),
  default: props => mainMetric(props.savedMetrics),
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
    label: t('Datasource'),
    default: null,
    description: null,
    mapStateToProps: (state, control, actions) => ({
      datasource: state.datasource,
      onDatasourceSave: actions ? actions.setDatasource : () => {},
    }),
  },

  viz_type: {
    type: 'VizTypeControl',
    label: t('Visualization Type'),
    default: 'table',
    description: t('The type of visualization to display'),
  },

  y_axis_bounds: {
    type: 'BoundsControl',
    label: t('Y Axis Bounds'),
    renderTrigger: true,
    default: [null, null],
    description: t(
      'Bounds for the Y-axis. When left empty, the bounds are ' +
        'dynamically defined based on the min/max of the data. Note that ' +
        "this feature will only expand the axis range. It won't " +
        "narrow the data's extent.",
    ),
  },

  color_picker: {
    label: t('Fixed Color'),
    description: t('Use this to define a static color for all circles'),
    type: 'ColorPickerControl',
    default: PRIMARY_COLOR,
    renderTrigger: true,
  },

  metric_2: {
    ...metric,
    label: t('Right Axis Metric'),
    clearable: true,
    description: t('Choose a metric for right axis'),
  },

  linear_color_scheme: {
    type: 'ColorSchemeControl',
    label: t('Linear Color Scheme'),
    choices: () =>
      sequentialSchemeRegistry.values().map(value => [value.id, value.label]),
    default: sequentialSchemeRegistry.getDefaultKey(),
    clearable: false,
    description: '',
    renderTrigger: true,
    schemes: () => sequentialSchemeRegistry.getMap(),
    isLinear: true,
  },

  normalize_across: {
    type: 'SelectControl',
    label: t('Normalize Across'),
    choices: [
      ['heatmap', 'heatmap'],
      ['x', 'x'],
      ['y', 'y'],
    ],
    default: 'heatmap',
    description: t(
      'Color will be rendered based on a ratio ' +
        'of the cell against the sum of across this ' +
        'criteria',
    ),
  },

  bar_stacked: {
    type: 'CheckboxControl',
    label: t('Stacked Bars'),
    renderTrigger: true,
    default: false,
    description: null,
  },

  show_markers: {
    type: 'CheckboxControl',
    label: t('Show Markers'),
    renderTrigger: true,
    default: false,
    description: t('Show data points as circle markers on the lines'),
  },

  show_bar_value: {
    type: 'CheckboxControl',
    label: t('Bar Values'),
    default: false,
    renderTrigger: true,
    description: t('Show the value on top of the bar'),
  },

  order_bars: {
    type: 'CheckboxControl',
    label: t('Sort Bars'),
    default: false,
    renderTrigger: true,
    description: t('Sort bars by x labels.'),
  },

  show_controls: {
    type: 'CheckboxControl',
    label: t('Extra Controls'),
    renderTrigger: true,
    default: false,
    description: t(
      'Whether to show extra controls or not. Extra controls ' +
        'include things like making mulitBar charts stacked ' +
        'or side by side.',
    ),
  },

  reduce_x_ticks: {
    type: 'CheckboxControl',
    label: t('Reduce X ticks'),
    renderTrigger: true,
    default: false,
    description: t(
      'Reduces the number of X-axis ticks to be rendered. ' +
        'If true, the x-axis will not overflow and labels may be ' +
        'missing. If false, a minimum width will be applied ' +
        'to columns and the width may overflow into an ' +
        'horizontal scroll.',
    ),
  },

  secondary_metric: {
    ...metric,
    label: t('Color Metric'),
    default: null,
    validators: [],
    description: t('A metric to use for color'),
  },
  select_country: {
    type: 'SelectControl',
    label: t('Country Name'),
    default: 'France',
    choices: [
      'Belgium',
      'Brazil',
      'Bulgaria',
      'China',
      'Egypt',
      'France',
      'Germany',
      'India',
      'Iran',
      'Italy',
      'Japan',
      'Korea',
      'Liechtenstein',
      'Morocco',
      'Myanmar',
      'Netherlands',
      'Portugal',
      'Russia',
      'Singapore',
      'Spain',
      'Switzerland',
      'Thailand',
      'Timorleste',
      'Uk',
      'Ukraine',
      'Usa',
      'Zambia',
    ].map(s => [s, s]),
    description: t('The name of the country that Superset should display'),
  },

  freq: {
    type: 'SelectControl',
    label: t('Frequency'),
    default: 'W-MON',
    freeForm: true,
    clearable: false,
    choices: [
      ['AS', 'Year (freq=AS)'],
      ['52W-MON', '52 weeks starting Monday (freq=52W-MON)'],
      ['W-SUN', '1 week starting Sunday (freq=W-SUN)'],
      ['W-MON', '1 week starting Monday (freq=W-MON)'],
      ['D', 'Day (freq=D)'],
      ['4W-MON', '4 weeks (freq=4W-MON)'],
    ],
    description: t(
      `The periodicity over which to pivot time. Users can provide
      "Pandas" offset alias.
      Click on the info bubble for more details on accepted "freq" expressions.`,
    ),
    tooltipOnClick: () => {
      window.open(
        'https://pandas.pydata.org/pandas-docs/stable/timeseries.html#offset-aliases',
      );
    },
  },

  groupby: groupByControl,

  columns: {
    ...groupByControl,
    label: t('Columns'),
    description: t('One or many controls to pivot as columns'),
  },

  all_columns: {
    type: 'SelectControl',
    multi: true,
    label: t('Columns'),
    default: [],
    description: t('Columns to display'),
    optionRenderer: c => <ColumnOption column={c} showType />,
    valueRenderer: c => <ColumnOption column={c} />,
    valueKey: 'column_name',
    allowAll: true,
    mapStateToProps: state => ({
      options: state.datasource ? state.datasource.columns : [],
    }),
    commaChoosesOption: false,
    freeForm: true,
  },

  longitude: {
    type: 'SelectControl',
    label: t('Longitude'),
    default: 1,
    validators: [validateNonEmpty],
    description: t('Select the longitude column'),
    mapStateToProps: state => ({
      choices: columnChoices(state.datasource),
    }),
  },

  latitude: {
    type: 'SelectControl',
    label: t('Latitude'),
    default: 1,
    validators: [validateNonEmpty],
    description: t('Select the latitude column'),
    mapStateToProps: state => ({
      choices: columnChoices(state.datasource),
    }),
  },

  polygon: {
    type: 'SelectControl',
    label: t('Polygon Column'),
    validators: [validateNonEmpty],
    description: t(
      'Select the polygon column. Each row should contain JSON.array(N) of [longitude, latitude] points',
    ),
    mapStateToProps: state => ({
      choices: columnChoices(state.datasource),
    }),
  },

  all_columns_x: {
    type: 'SelectControl',
    label: 'X',
    default: null,
    description: t('Columns to display'),
    mapStateToProps: state => ({
      choices: columnChoices(state.datasource),
    }),
  },

  all_columns_y: {
    type: 'SelectControl',
    label: 'Y',
    default: null,
    description: t('Columns to display'),
    mapStateToProps: state => ({
      choices: columnChoices(state.datasource),
    }),
  },

  druid_time_origin: {
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
  },

  bottom_margin: {
    type: 'SelectControl',
    clearable: false,
    freeForm: true,
    label: t('Bottom Margin'),
    choices: formatSelectOptions(['auto', 50, 75, 100, 125, 150, 200]),
    default: 'auto',
    renderTrigger: true,
    description: t(
      'Bottom margin, in pixels, allowing for more room for axis labels',
    ),
  },

  x_ticks_layout: {
    type: 'SelectControl',
    label: t('X Tick Layout'),
    choices: formatSelectOptions(['auto', 'flat', '45°', 'staggered']),
    default: 'auto',
    clearable: false,
    renderTrigger: true,
    description: t('The way the ticks are laid out on the X-axis'),
  },

  left_margin: {
    type: 'SelectControl',
    freeForm: true,
    clearable: false,
    label: t('Left Margin'),
    choices: formatSelectOptions(['auto', 50, 75, 100, 125, 150, 200]),
    default: 'auto',
    renderTrigger: true,
    description: t(
      'Left margin, in pixels, allowing for more room for axis labels',
    ),
  },

  granularity: {
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
  },

  link_length: {
    type: 'SelectControl',
    renderTrigger: true,
    freeForm: true,
    label: t('Link Length'),
    default: '200',
    choices: formatSelectOptions([
      '10',
      '25',
      '50',
      '75',
      '100',
      '150',
      '200',
      '250',
    ]),
    description: t('Link length in the force layout'),
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
    default: control => control.default,
    clearable: false,
    optionRenderer: c => <ColumnOption column={c} showType />,
    valueRenderer: c => <ColumnOption column={c} />,
    valueKey: 'column_name',
    mapStateToProps: state => {
      const props = {};
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
    default: t('Last week'), // this value is translated, but the backend wouldn't understand a translated value?
    description: t(
      'The time range for the visualization. All relative times, e.g. "Last month", ' +
        '"Last 7 days", "now", etc. are evaluated on the server using the server\'s ' +
        'local time (sans timezone). All tooltips and placeholder times are expressed ' +
        'in UTC (sans timezone). The timestamps are then evaluated by the database ' +
        "using the engine's local timezone. Note one can explicitly set the timezone " +
        'per the ISO 8601 format if specifying either the start and/or end time.',
    ),
    mapStateToProps: state => ({
      endpoints: state.form_data ? state.form_data.time_range_endpoints : null,
    }),
  },

  time_range_fixed: {
    type: 'CheckboxControl',
    label: t('Fix to selected Time Range'),
    description: t(
      'Fix the trend line to the full time range specified in case filtered results do not include the start or end dates',
    ),
    renderTrigger: true,
    visibility(props) {
      const {
        time_range: timeRange,
        viz_type: vizType,
        show_trend_line: showTrendLine,
      } = props.form_data;
      // only display this option when a time range is selected
      return timeRange && timeRange !== 'No filter';
    },
  },

  max_bubble_size: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Max Bubble Size'),
    default: '25',
    choices: formatSelectOptions(['5', '10', '15', '25', '50', '75', '100']),
  },

  number_format: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Number format'),
    renderTrigger: true,
    default: 'SMART_NUMBER',
    choices: D3_FORMAT_OPTIONS,
    description: D3_FORMAT_DOCS,
  },

  row_limit: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Row limit'),
    validators: [legacyValidateInteger],
    default: 10000,
    choices: formatSelectOptions(ROW_LIMIT_OPTIONS),
  },

  limit: {
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
  },

  timeseries_limit_metric: {
    type: 'MetricsControl',
    label: t('Sort By'),
    default: null,
    description: t('Metric used to define the top series'),
    mapStateToProps: state => ({
      columns: state.datasource ? state.datasource.columns : [],
      savedMetrics: state.datasource ? state.datasource.metrics : [],
      datasourceType: state.datasource && state.datasource.type,
    }),
  },

  order_desc: {
    type: 'CheckboxControl',
    label: t('Sort Descending'),
    default: true,
    description: t('Whether to sort descending or ascending'),
  },

  rolling_type: {
    type: 'SelectControl',
    label: t('Rolling Function'),
    default: 'None',
    choices: formatSelectOptions(['None', 'mean', 'sum', 'std', 'cumsum']),
    description: t(
      'Defines a rolling window function to apply, works along ' +
        'with the [Periods] text box',
    ),
  },

  rolling_periods: {
    type: 'TextControl',
    label: t('Periods'),
    isInt: true,
    description: t(
      'Defines the size of the rolling window function, ' +
        'relative to the time granularity selected',
    ),
  },

  min_periods: {
    type: 'TextControl',
    label: t('Min Periods'),
    isInt: true,
    description: t(
      'The minimum number of rolling periods required to show ' +
        'a value. For instance if you do a cumulative sum on 7 days ' +
        'you may want your "Min Period" to be 7, so that all data points ' +
        'shown are the total of 7 periods. This will hide the "ramp up" ' +
        'taking place over the first 7 periods',
    ),
  },

  series: {
    ...groupByControl,
    label: t('Series'),
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
    label: t('Bubble Size'),
    default: null,
  },

  url: {
    type: 'TextControl',
    label: t('URL'),
    description: t(
      'The URL, this control is templated, so you can integrate ' +
        '{{ width }} and/or {{ height }} in your URL string.',
    ),
    default: '',
  },

  x_axis_label: {
    type: 'TextControl',
    label: t('X Axis Label'),
    renderTrigger: true,
    default: '',
  },

  y_axis_label: {
    type: 'TextControl',
    label: t('Y Axis Label'),
    renderTrigger: true,
    default: '',
  },

  x_axis_format: {
    type: 'SelectControl',
    freeForm: true,
    label: t('X Axis Format'),
    renderTrigger: true,
    default: 'SMART_NUMBER',
    choices: D3_FORMAT_OPTIONS,
    description: D3_FORMAT_DOCS,
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

  y_axis_2_format: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Right Axis Format'),
    default: 'SMART_NUMBER',
    choices: D3_FORMAT_OPTIONS,
    description: D3_FORMAT_DOCS,
  },

  date_time_format: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Date Time Format'),
    renderTrigger: true,
    default: 'smart_date',
    choices: D3_TIME_FORMAT_OPTIONS,
    description: D3_FORMAT_DOCS,
  },

  markup_type: {
    type: 'SelectControl',
    label: t('Markup Type'),
    clearable: false,
    choices: formatSelectOptions(['markdown', 'html']),
    default: 'markdown',
    validators: [validateNonEmpty],
    description: t('Pick your favorite markup language'),
  },

  line_interpolation: {
    type: 'SelectControl',
    label: t('Line Style'),
    renderTrigger: true,
    choices: formatSelectOptions([
      'linear',
      'basis',
      'cardinal',
      'monotone',
      'step-before',
      'step-after',
    ]),
    default: 'linear',
    description: t('Line interpolation as defined by d3.js'),
  },

  code: {
    type: 'TextAreaControl',
    label: t('Code'),
    description: t('Put your code here'),
    mapStateToProps: state => ({
      language:
        state.controls && state.controls.markup_type
          ? state.controls.markup_type.value
          : 'markdown',
    }),
    default: '',
  },

  pandas_aggfunc: {
    type: 'SelectControl',
    label: t('Aggregation function'),
    clearable: false,
    choices: formatSelectOptions(['sum', 'mean', 'min', 'max', 'std', 'var']),
    default: 'sum',
    description: t(
      'Aggregate function to apply when pivoting and ' +
        'computing the total rows and columns',
    ),
  },

  show_brush: {
    type: 'SelectControl',
    label: t('Show Range Filter'),
    renderTrigger: true,
    clearable: false,
    default: 'auto',
    choices: [
      ['yes', 'Yes'],
      ['no', 'No'],
      ['auto', 'Auto'],
    ],
    description: t('Whether to display the time range interactive selector'),
  },

  table_filter: {
    type: 'CheckboxControl',
    label: t('Emit Filter Events'),
    renderTrigger: true,
    default: false,
    description: t('Whether to apply filter when items are clicked'),
  },

  show_legend: {
    type: 'CheckboxControl',
    label: t('Legend'),
    renderTrigger: true,
    default: true,
    description: t('Whether to display the legend (toggles)'),
  },

  send_time_range: {
    type: 'CheckboxControl',
    label: t('Propagate'),
    renderTrigger: true,
    default: false,
    description: t('Send range filter events to other charts'),
  },

  show_labels: {
    type: 'CheckboxControl',
    label: t('Show Labels'),
    renderTrigger: true,
    default: true,
    description: t(
      'Whether to display the labels. Note that the label only displays when the the 5% ' +
        'threshold.',
    ),
  },

  show_values: {
    type: 'CheckboxControl',
    label: t('Show Values'),
    renderTrigger: true,
    default: false,
    description: t('Whether to display the numerical values within the cells'),
  },

  x_axis_showminmax: {
    type: 'CheckboxControl',
    label: t('X bounds'),
    renderTrigger: true,
    default: false,
    description: t('Whether to display the min and max values of the X-axis'),
  },

  y_axis_showminmax: {
    type: 'CheckboxControl',
    label: t('Y bounds'),
    renderTrigger: true,
    default: false,
    description: t('Whether to display the min and max values of the Y-axis'),
  },

  rich_tooltip: {
    type: 'CheckboxControl',
    label: t('Rich Tooltip'),
    renderTrigger: true,
    default: true,
    description: t(
      'The rich tooltip shows a list of all series for that point in time',
    ),
  },

  y_log_scale: {
    type: 'CheckboxControl',
    label: t('Y Log Scale'),
    default: false,
    renderTrigger: true,
    description: t('Use a log scale for the Y-axis'),
  },

  log_scale: {
    type: 'CheckboxControl',
    label: t('Log Scale'),
    default: false,
    renderTrigger: true,
    description: t('Use a log scale'),
  },

  contribution: {
    type: 'CheckboxControl',
    label: t('Contribution'),
    default: false,
    description: t('Compute the contribution to the total'),
  },

  comparison_type: {
    type: 'SelectControl',
    label: t('Calculation type'),
    default: 'values',
    choices: [
      ['values', 'Actual Values'],
      ['absolute', 'Absolute difference'],
      ['percentage', 'Percentage change'],
      ['ratio', 'Ratio'],
    ],
    description: t(
      'How to display time shifts: as individual lines; as the ' +
        'absolute difference between the main time series and each time shift; ' +
        'as the percentage change; or as the ratio between series and time shifts.',
    ),
  },

  mapbox_label: {
    type: 'SelectControl',
    multi: true,
    label: t('label'),
    default: [],
    description: t(
      '`count` is COUNT(*) if a group by is used. ' +
        'Numerical columns will be aggregated with the aggregator. ' +
        'Non-numerical columns will be used to label points. ' +
        'Leave empty to get a count of points in each cluster.',
    ),
    mapStateToProps: state => ({
      choices: columnChoices(state.datasource),
    }),
  },

  mapbox_style: {
    type: 'SelectControl',
    label: t('Map Style'),
    clearable: false,
    renderTrigger: true,
    choices: [
      ['mapbox://styles/mapbox/streets-v9', 'Streets'],
      ['mapbox://styles/mapbox/dark-v9', 'Dark'],
      ['mapbox://styles/mapbox/light-v9', 'Light'],
      ['mapbox://styles/mapbox/satellite-streets-v9', 'Satellite Streets'],
      ['mapbox://styles/mapbox/satellite-v9', 'Satellite'],
      ['mapbox://styles/mapbox/outdoors-v9', 'Outdoors'],
    ],
    default: 'mapbox://styles/mapbox/light-v9',
    description: t('Base layer map style'),
  },

  global_opacity: {
    type: 'TextControl',
    label: t('Opacity'),
    default: 1,
    isFloat: true,
    description: t(
      'Opacity of all clusters, points, and labels. Between 0 and 1.',
    ),
  },

  viewport_zoom: {
    type: 'TextControl',
    label: t('Zoom'),
    renderTrigger: true,
    isFloat: true,
    default: 11,
    description: t('Zoom level of the map'),
    places: 8,
    // Viewport zoom shouldn't prompt user to re-run query
    dontRefreshOnChange: true,
  },

  color: {
    type: 'ColorPickerControl',
    label: t('Color'),
    default: PRIMARY_COLOR,
    description: t('Pick a color'),
  },

  annotation_layers: {
    type: 'AnnotationLayerControl',
    label: '',
    default: [],
    description: 'Annotation Layers',
    renderTrigger: true,
    tabOverride: 'data',
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
    provideFormDataToProps: true,
  },

  slice_id: {
    type: 'HiddenControl',
    label: t('Chart ID'),
    hidden: true,
    description: t('The id of the active chart'),
  },

  cache_timeout: {
    type: 'HiddenControl',
    label: t('Cache Timeout (seconds)'),
    hidden: true,
    description: t('The number of seconds before expiring the cache'),
  },

  url_params: {
    type: 'HiddenControl',
    label: t('URL Parameters'),
    hidden: true,
    description: t('Extra parameters for use in jinja templated queries'),
  },

  time_range_endpoints: {
    type: 'HiddenControl',
    label: t('Time range endpoints'),
    hidden: true,
    description: t('Time range endpoints (SIP-15)'),
  },

  color_scheme: {
    type: 'ColorSchemeControl',
    label: t('Color Scheme'),
    default: categoricalSchemeRegistry.getDefaultKey(),
    renderTrigger: true,
    choices: () => categoricalSchemeRegistry.keys().map(s => [s, s]),
    description: t('The color scheme for rendering chart'),
    schemes: () => categoricalSchemeRegistry.getMap(),
  },

  label_colors: {
    type: 'ColorMapControl',
    label: t('Color Map'),
    default: {},
    renderTrigger: true,
    mapStateToProps: state => ({
      colorNamespace: state.form_data.color_namespace,
      colorScheme: state.form_data.color_scheme,
    }),
  },

  column_collection: {
    type: 'CollectionControl',
    label: t('Time Series Columns'),
    validators: [validateNonEmpty],
    controlName: 'TimeSeriesColumnControl',
  },

  filter_configs: {
    type: 'CollectionControl',
    label: 'Filters',
    description: t('Filter configuration for the filter box'),
    validators: [],
    controlName: 'FilterBoxItemControl',
    mapStateToProps: ({ datasource }) => ({ datasource }),
  },

  normalized: {
    type: 'CheckboxControl',
    label: t('Normalized'),
    renderTrigger: true,
    description: t('Whether to normalize the histogram'),
    default: false,
  },
};
export default controls;

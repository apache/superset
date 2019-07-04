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
import { getCategoricalSchemeRegistry, getSequentialSchemeRegistry } from '@superset-ui/color';

import {
  formatSelectOptionsForRange,
  formatSelectOptions,
  mainMetric,
} from '../modules/utils';
import * as v from './validators';
import { defaultViewport } from '../modules/geo';
import ColumnOption from '../components/ColumnOption';
import OptionDescription from '../components/OptionDescription';

const categoricalSchemeRegistry = getCategoricalSchemeRegistry();
const sequentialSchemeRegistry = getSequentialSchemeRegistry();

const PRIMARY_COLOR = { r: 0, g: 122, b: 135, a: 1 };

const D3_FORMAT_DOCS = 'D3 format syntax: https://github.com/d3/d3-format';

// input choices & options
const D3_FORMAT_OPTIONS = [
  ['SMART_NUMBER', 'Adaptative formating'],
  ['.1s', '.1s (12345.432 => 10k)'],
  ['.3s', '.3s (12345.432 => 12.3k)'],
  [',.1%', ',.1% (12345.432 => 1,234,543.2%)'],
  ['.3%', '.3% (12345.432 => 1234543.200%)'],
  ['.4r', '.4r (12345.432 => 12350)'],
  [',.3f', ',.3f (12345.432 => 12,345.432)'],
  ['+,', '+, (12345.432 => +12,345.432)'],
  ['$,.2f', '$,.2f (12345.432 => $12,345.43)'],
];

const ROW_LIMIT_OPTIONS = [10, 50, 100, 250, 500, 1000, 5000, 10000, 50000];

const SERIES_LIMITS = [0, 5, 10, 25, 50, 100, 500];

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
  'account'),
};
const sortAxisChoices = [
  ['alpha_asc', 'Axis ascending'],
  ['alpha_desc', 'Axis descending'],
  ['value_asc', 'sum(value) ascending'],
  ['value_desc', 'sum(value) descending'],
];

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
  filterOption: (opt, text) => (
    (opt.column_name && opt.column_name.toLowerCase().indexOf(text.toLowerCase()) >= 0) ||
    (opt.verbose_name && opt.verbose_name.toLowerCase().indexOf(text.toLowerCase()) >= 0)
  ),
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
  validators: [v.nonEmpty],
  default: (c) => {
    const metric = mainMetric(c.savedMetrics);
    return metric ? [metric] : null;
  },
  mapStateToProps: (state) => {
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

const sandboxUrl = (
  'https://github.com/apache/incubator-superset/' +
  'blob/master/superset/assets/src/modules/sandbox.js');
const jsFunctionInfo = (
  <div>
    {t('For more information about objects are in context in the scope of this function, refer to the')}
    <a href={sandboxUrl}>
      {t(" source code of Superset's sandboxed parser")}.
    </a>.
  </div>
);

function columnChoices(datasource) {
  if (datasource && datasource.columns) {
    return datasource.columns
      .map(col => [col.column_name, col.verbose_name || col.column_name])
      .sort((opt1, opt2) => opt1[1].toLowerCase() > opt2[1].toLowerCase() ? 1 : -1);
  }
  return [];
}

function jsFunctionControl(label, description, extraDescr = null, height = 100, defaultText = '') {
  return {
    type: 'TextAreaControl',
    language: 'javascript',
    label,
    description,
    height,
    default: defaultText,
    aboveEditorSection: (
      <div>
        <p>{description}</p>
        <p>{jsFunctionInfo}</p>
        {extraDescr}
      </div>
    ),
    mapStateToProps: state => ({
      warning: !state.common.conf.ENABLE_JAVASCRIPT_CONTROLS ?
        t('This functionality is disabled in your environment for security reasons.') : null,
      readOnly: !state.common.conf.ENABLE_JAVASCRIPT_CONTROLS,
    }),
  };
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

  percent_metrics: {
    ...metrics,
    multi: true,
    default: [],
    label: t('Percentage Metrics'),
    validators: [],
    description: t('Metrics for which percentage of total are to be displayed'),
  },

  y_axis_bounds: {
    type: 'BoundsControl',
    label: t('Y Axis Bounds'),
    renderTrigger: true,
    default: [null, null],
    description: t('Bounds for the Y-axis. When left empty, the bounds are ' +
    'dynamically defined based on the min/max of the data. Note that ' +
    "this feature will only expand the axis range. It won't " +
    "narrow the data's extent."),
  },

  order_by_cols: {
    type: 'SelectControl',
    multi: true,
    label: t('Ordering'),
    default: [],
    description: t('One or many metrics to display'),
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.order_by_choices : [],
    }),
  },
  color_picker: {
    label: t('Fixed Color'),
    description: t('Use this to define a static color for all circles'),
    type: 'ColorPickerControl',
    default: PRIMARY_COLOR,
    renderTrigger: true,
  },

  target_color_picker: {
    label: t('Target Color'),
    description: t('Color of the target location'),
    type: 'ColorPickerControl',
    default: PRIMARY_COLOR,
    renderTrigger: true,
  },

  legend_position: {
    label: t('Legend Position'),
    description: t('Choose the position of the legend'),
    type: 'SelectControl',
    clearable: false,
    default: 'tr',
    choices: [
      [null, 'None'],
      ['tl', 'Top left'],
      ['tr', 'Top right'],
      ['bl', 'Bottom left'],
      ['br', 'Bottom right'],
    ],
    renderTrigger: true,
  },

  fill_color_picker: {
    label: t('Fill Color'),
    description: t(' Set the opacity to 0 if you do not want to override the color specified in the GeoJSON'),
    type: 'ColorPickerControl',
    default: PRIMARY_COLOR,
    renderTrigger: true,
  },

  stroke_color_picker: {
    label: t('Stroke Color'),
    description: t(' Set the opacity to 0 if you do not want to override the color specified in the GeoJSON'),
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

  stacked_style: {
    type: 'SelectControl',
    label: t('Stacked Style'),
    renderTrigger: true,
    choices: [
      ['stack', 'stack'],
      ['stream', 'stream'],
      ['expand', 'expand'],
    ],
    default: 'stack',
    description: '',
  },

  sort_x_axis: {
    type: 'SelectControl',
    label: t('Sort X Axis'),
    choices: sortAxisChoices,
    clearable: false,
    default: 'alpha_asc',
  },

  sort_y_axis: {
    type: 'SelectControl',
    label: t('Sort Y Axis'),
    choices: sortAxisChoices,
    clearable: false,
    default: 'alpha_asc',
  },

  linear_color_scheme: {
    type: 'ColorSchemeControl',
    label: t('Linear Color Scheme'),
    choices: () => sequentialSchemeRegistry
      .values()
      .map(value => [value.id, value.label]),
    default: 'blue_white_yellow',
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
    description: t('Color will be rendered based on a ratio ' +
    'of the cell against the sum of across this ' +
    'criteria'),
  },

  horizon_color_scale: {
    type: 'SelectControl',
    renderTrigger: true,
    label: t('Value Domain'),
    choices: [
      ['series', 'series'],
      ['overall', 'overall'],
      ['change', 'change'],
    ],
    default: 'series',
    description: t('series: Treat each series independently; overall: All series use the same scale; change: Show changes compared to the first data point in each series'),
  },

  canvas_image_rendering: {
    type: 'SelectControl',
    label: t('Rendering'),
    renderTrigger: true,
    choices: [
      ['pixelated', 'pixelated (Sharp)'],
      ['auto', 'auto (Smooth)'],
    ],
    default: 'pixelated',
    description: t('image-rendering CSS attribute of the canvas object that ' +
    'defines how the browser scales up the image'),
  },

  xscale_interval: {
    type: 'SelectControl',
    label: t('XScale Interval'),
    renderTrigger: true,
    choices: formatSelectOptionsForRange(1, 50),
    default: '1',
    clearable: false,
    description: t('Number of steps to take between ticks when ' +
    'displaying the X scale'),
  },

  yscale_interval: {
    type: 'SelectControl',
    label: t('YScale Interval'),
    choices: formatSelectOptionsForRange(1, 50),
    default: '1',
    clearable: false,
    renderTrigger: true,
    description: t('Number of steps to take between ticks when ' +
    'displaying the Y scale'),
  },

  include_time: {
    type: 'CheckboxControl',
    label: t('Include Time'),
    description: t('Whether to include the time granularity as defined in the time section'),
    default: false,
  },

  autozoom: {
    type: 'CheckboxControl',
    label: t('Auto Zoom'),
    default: true,
    renderTrigger: true,
    description: t('When checked, the map will zoom to your data after each query'),
  },

  show_perc: {
    type: 'CheckboxControl',
    label: t('Show percentage'),
    renderTrigger: true,
    description: t('Whether to include the percentage in the tooltip'),
    default: true,
  },

  bar_stacked: {
    type: 'CheckboxControl',
    label: t('Stacked Bars'),
    renderTrigger: true,
    default: false,
    description: null,
  },

  pivot_margins: {
    type: 'CheckboxControl',
    label: t('Show totals'),
    renderTrigger: false,
    default: true,
    description: t('Display total row/column'),
  },

  transpose_pivot: {
    type: 'CheckboxControl',
    label: t('Transpose Pivot'),
    default: false,
    description: t('Swap Groups and Columns'),
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

  combine_metric: {
    type: 'CheckboxControl',
    label: t('Combine Metrics'),
    default: false,
    description: t('Display metrics side by side within each column, as ' +
    'opposed to each column being displayed side by side for each metric.'),
  },

  show_controls: {
    type: 'CheckboxControl',
    label: t('Extra Controls'),
    renderTrigger: true,
    default: false,
    description: t('Whether to show extra controls or not. Extra controls ' +
    'include things like making mulitBar charts stacked ' +
    'or side by side.'),
  },

  reduce_x_ticks: {
    type: 'CheckboxControl',
    label: t('Reduce X ticks'),
    renderTrigger: true,
    default: false,
    description: t('Reduces the number of X-axis ticks to be rendered. ' +
    'If true, the x-axis will not overflow and labels may be ' +
    'missing. If false, a minimum width will be applied ' +
    'to columns and the width may overflow into an ' +
    'horizontal scroll.'),
  },

  include_series: {
    type: 'CheckboxControl',
    label: t('Include Series'),
    renderTrigger: true,
    default: false,
    description: t('Include series name as an axis'),
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
      'Italy',
      'Japan',
      'Morocco',
      'Myanmar',
      'Netherlands',
      'Portugal',
      'Russia',
      'Singapore',
      'Spain',
      'Thailand',
      'Timorleste',
      'Uk',
      'Ukraine',
      'Usa',
      'Zambia',
    ].map(s => [s, s]),
    description: t('The name of the country that Superset should display'),
  },
  country_fieldtype: {
    type: 'SelectControl',
    label: t('Country Field Type'),
    default: 'cca2',
    choices: [
      ['name', 'Full name'],
      ['cioc', 'code International Olympic Committee (cioc)'],
      ['cca2', 'code ISO 3166-1 alpha-2 (cca2)'],
      ['cca3', 'code ISO 3166-1 alpha-3 (cca3)'],
    ],
    description: t('The country code standard that Superset should expect ' +
    'to find in the [country] column'),
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
      Click on the info bubble for more details on accepted "freq" expressions.`),
    tooltipOnClick: () => {
      window.open(
        'https://pandas.pydata.org/pandas-docs/stable/timeseries.html#offset-aliases');
    },
  },

  groupby: groupByControl,
  dimension: {
    ...groupByControl,
    label: t('Dimension'),
    description: t('Select a dimension'),
    multi: false,
    default: null,
  },

  columns: Object.assign({}, groupByControl, {
    label: t('Columns'),
    description: t('One or many controls to pivot as columns'),
  }),

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
      options: (state.datasource) ? state.datasource.columns : [],
    }),
    commaChoosesOption: false,
    freeForm: true,
  },

  spatial: {
    type: 'SpatialControl',
    label: t('Longitude & Latitude'),
    validators: [v.nonEmpty],
    description: t('Point to your spatial columns'),
    mapStateToProps: state => ({
      choices: columnChoices(state.datasource),
    }),
  },

  start_spatial: {
    type: 'SpatialControl',
    label: t('Start Longitude & Latitude'),
    validators: [v.nonEmpty],
    description: t('Point to your spatial columns'),
    mapStateToProps: state => ({
      choices: columnChoices(state.datasource),
    }),
  },

  end_spatial: {
    type: 'SpatialControl',
    label: t('End Longitude & Latitude'),
    validators: [v.nonEmpty],
    description: t('Point to your spatial columns'),
    mapStateToProps: state => ({
      choices: columnChoices(state.datasource),
    }),
  },

  longitude: {
    type: 'SelectControl',
    label: t('Longitude'),
    default: 1,
    validators: [v.nonEmpty],
    description: t('Select the longitude column'),
    mapStateToProps: state => ({
      choices: columnChoices(state.datasource),
    }),
  },

  latitude: {
    type: 'SelectControl',
    label: t('Latitude'),
    default: 1,
    validators: [v.nonEmpty],
    description: t('Select the latitude column'),
    mapStateToProps: state => ({
      choices: columnChoices(state.datasource),
    }),
  },

  filter_nulls: {
    type: 'CheckboxControl',
    label: t('Ignore null locations'),
    default: true,
    description: t('Whether to ignore locations that are null'),
  },

  geojson: {
    type: 'SelectControl',
    label: t('GeoJson Column'),
    validators: [v.nonEmpty],
    description: t('Select the geojson column'),
    mapStateToProps: state => ({
      choices: columnChoices(state.datasource),
    }),
  },

  polygon: {
    type: 'SelectControl',
    label: t('Polygon Column'),
    validators: [v.nonEmpty],
    description: t('Select the polygon column. Each row should contain JSON.array(N) of [longitude, latitude] points'),
    mapStateToProps: state => ({
      choices: columnChoices(state.datasource),
    }),
  },

  point_radius_scale: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Point Radius Scale'),
    validators: [v.integer],
    default: null,
    choices: formatSelectOptions([0, 100, 200, 300, 500]),
  },

  stroke_width: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Stroke Width'),
    validators: [v.integer],
    default: null,
    renderTrigger: true,
    choices: formatSelectOptions([1, 2, 3, 4, 5]),
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
    label: t('Origin'),
    choices: [
      ['', 'default'],
      ['now', 'now'],
    ],
    default: null,
    description: t('Defines the origin where time buckets start, ' +
    'accepts natural dates as in `now`, `sunday` or `1970-01-01`'),
  },

  bottom_margin: {
    type: 'SelectControl',
    clearable: false,
    freeForm: true,
    label: t('Bottom Margin'),
    choices: formatSelectOptions(['auto', 50, 75, 100, 125, 150, 200]),
    default: 'auto',
    renderTrigger: true,
    description: t('Bottom margin, in pixels, allowing for more room for axis labels'),
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
    description: t('Left margin, in pixels, allowing for more room for axis labels'),
  },

  granularity: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Time Granularity'),
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
    description: t('The time granularity for the visualization. Note that you ' +
    'can type and use simple natural language as in `10 seconds`, ' +
    '`1 day` or `56 weeks`'),
  },

  domain_granularity: {
    type: 'SelectControl',
    label: t('Domain'),
    default: 'month',
    choices: formatSelectOptions(['hour', 'day', 'week', 'month', 'year']),
    description: t('The time unit used for the grouping of blocks'),
  },

  subdomain_granularity: {
    type: 'SelectControl',
    label: t('Subdomain'),
    default: 'day',
    choices: formatSelectOptions(['min', 'hour', 'day', 'week', 'month']),
    description: t('The time unit for each block. Should be a smaller unit than ' +
    'domain_granularity. Should be larger or equal to Time Grain'),
  },

  link_length: {
    type: 'SelectControl',
    renderTrigger: true,
    freeForm: true,
    label: t('Link Length'),
    default: '200',
    choices: formatSelectOptions(['10', '25', '50', '75', '100', '150', '200', '250']),
    description: t('Link length in the force layout'),
  },

  charge: {
    type: 'SelectControl',
    renderTrigger: true,
    freeForm: true,
    label: t('Charge'),
    default: '-500',
    choices: formatSelectOptions([
      '-50',
      '-75',
      '-100',
      '-150',
      '-200',
      '-250',
      '-500',
      '-1000',
      '-2500',
      '-5000',
    ]),
    description: t('Charge in the force layout'),
  },

  granularity_sqla: {
    type: 'SelectControl',
    label: t('Time Column'),
    description: t('The time column for the visualization. Note that you ' +
    'can define arbitrary expression that return a DATETIME ' +
    'column in the table. Also note that the ' +
    'filter below is applied against this column or ' +
    'expression'),
    default: control => control.default,
    clearable: false,
    optionRenderer: c => <ColumnOption column={c} showType />,
    valueRenderer: c => <ColumnOption column={c} />,
    valueKey: 'column_name',
    mapStateToProps: (state) => {
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
    label: t('Time Grain'),
    default: 'P1D',
    description: t('The time granularity for the visualization. This ' +
    'applies a date transformation to alter ' +
    'your time column and defines a new time granularity. ' +
    'The options here are defined on a per database ' +
    'engine basis in the Superset source code.'),
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.time_grain_sqla : null,
    }),
  },

  resample_rule: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Rule'),
    default: null,
    choices: formatSelectOptions(['1T', '1H', '1D', '7D', '1M', '1AS']),
    description: t('Pandas resample rule'),
  },

  resample_method: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Method'),
    default: null,
    choices: formatSelectOptions(['asfreq', 'bfill', 'ffill', 'median', 'mean', 'sum']),
    description: t('Pandas resample method'),
  },

  time_range: {
    type: 'DateFilterControl',
    freeForm: true,
    label: t('Time range'),
    default: t('Last week'),
  },

  max_bubble_size: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Max Bubble Size'),
    default: '25',
    choices: formatSelectOptions(['5', '10', '15', '25', '50', '75', '100']),
  },

  whisker_options: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Whisker/outlier options'),
    default: 'Tukey',
    description: t('Determines how whiskers and outliers are calculated.'),
    choices: formatSelectOptions([
      'Tukey',
      'Min/max (no outliers)',
      '2/98 percentiles',
      '9/91 percentiles',
    ]),
  },

  treemap_ratio: {
    type: 'TextControl',
    label: t('Ratio'),
    renderTrigger: true,
    isFloat: true,
    default: 0.5 * (1 + Math.sqrt(5)),  // d3 default, golden ratio
    description: t('Target aspect ratio for treemap tiles.'),
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
    validators: [v.integer],
    default: 10000,
    choices: formatSelectOptions(ROW_LIMIT_OPTIONS),
  },

  limit: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Series limit'),
    validators: [v.integer],
    choices: formatSelectOptions(SERIES_LIMITS),
    description: t(
      'Limits the number of time series that get displayed. A sub query ' +
      '(or an extra phase where sub queries are not supported) is applied to limit ' +
      'the number of time series that get fetched and displayed. This feature is useful ' +
      'when grouping by high cardinality dimension(s).'),
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
    label: t('Rolling'),
    default: 'None',
    choices: formatSelectOptions(['None', 'mean', 'sum', 'std', 'cumsum']),
    description: t('Defines a rolling window function to apply, works along ' +
    'with the [Periods] text box'),
  },

  multiplier: {
    type: 'TextControl',
    label: t('Multiplier'),
    isFloat: true,
    renderTrigger: true,
    default: 1,
    description: t('Factor to multiply the metric by'),
  },

  rolling_periods: {
    type: 'TextControl',
    label: t('Periods'),
    isInt: true,
    description: t('Defines the size of the rolling window function, ' +
    'relative to the time granularity selected'),
  },

  cell_size: {
    type: 'TextControl',
    isInt: true,
    default: 10,
    validators: [v.integer],
    renderTrigger: true,
    label: t('Cell Size'),
    description: t('The size of the square cell, in pixels'),
  },

  cell_padding: {
    type: 'TextControl',
    isInt: true,
    validators: [v.integer],
    renderTrigger: true,
    default: 2,
    label: t('Cell Padding'),
    description: t('The distance between cells, in pixels'),
  },

  cell_radius: {
    type: 'TextControl',
    isInt: true,
    validators: [v.integer],
    renderTrigger: true,
    default: 0,
    label: t('Cell Radius'),
    description: t('The pixel radius'),
  },

  steps: {
    type: 'TextControl',
    isInt: true,
    validators: [v.integer],
    renderTrigger: true,
    default: 10,
    label: t('Color Steps'),
    description: t('The number color "steps"'),
  },

  grid_size: {
    type: 'TextControl',
    label: t('Grid Size'),
    renderTrigger: true,
    default: 20,
    isInt: true,
    description: t('Defines the grid size in pixels'),
  },

  min_periods: {
    type: 'TextControl',
    label: t('Min Periods'),
    isInt: true,
    description: t('The minimum number of rolling periods required to show ' +
    'a value. For instance if you do a cumulative sum on 7 days ' +
    'you may want your "Min Period" to be 7, so that all data points ' +
    'shown are the total of 7 periods. This will hide the "ramp up" ' +
    'taking place over the first 7 periods'),
  },

  series: {
    ...groupByControl,
    label: t('Series'),
    multi: false,
    default: null,
    description: t('Defines the grouping of entities. ' +
    'Each series is shown as a specific color on the chart and ' +
    'has a legend toggle'),
  },

  entity: {
    ...groupByControl,
    label: t('Entity'),
    default: null,
    multi: false,
    validators: [v.nonEmpty],
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
    description: t('The URL, this control is templated, so you can integrate ' +
    '{{ width }} and/or {{ height }} in your URL string.'),
    default: 'https://www.youtube.com/embed/AdSZJzb-aX8',
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

  compare_lag: {
    type: 'TextControl',
    label: t('Comparison Period Lag'),
    isInt: true,
    description: t('Based on granularity, number of time periods to compare against'),
  },

  compare_suffix: {
    type: 'TextControl',
    label: t('Comparison suffix'),
    description: t('Suffix to apply after the percentage display'),
  },

  table_timestamp_format: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Table Timestamp Format'),
    default: '%Y-%m-%d %H:%M:%S',
    renderTrigger: true,
    validators: [v.nonEmpty],
    clearable: false,
    choices: D3_TIME_FORMAT_OPTIONS,
    description: t('Timestamp Format'),
  },

  series_height: {
    type: 'SelectControl',
    renderTrigger: true,
    freeForm: true,
    label: t('Series Height'),
    default: '25',
    choices: formatSelectOptions(['10', '25', '40', '50', '75', '100', '150', '200']),
    description: t('Pixel height of each series'),
  },

  page_length: {
    type: 'SelectControl',
    freeForm: true,
    renderTrigger: true,
    label: t('Page Length'),
    default: 0,
    choices: formatSelectOptions([0, 10, 25, 40, 50, 75, 100, 150, 200]),
    description: t('Rows per page, 0 means no pagination'),
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

  x_axis_time_format: {
    type: 'SelectControl',
    freeForm: true,
    label: t('X Axis Format'),
    renderTrigger: true,
    default: 'smart_date',
    choices: D3_TIME_FORMAT_OPTIONS,
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
    mapStateToProps: (state) => {
      const showWarning = (
          state.controls &&
          state.controls.comparison_type &&
          state.controls.comparison_type.value === 'percentage');
      return {
        warning: showWarning ?
          t('When `Calculation type` is set to "Percentage change", the Y ' +
            'Axis Format is forced to `.1%`') : null,
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
    validators: [v.nonEmpty],
    description: t('Pick your favorite markup language'),
  },

  rotation: {
    type: 'SelectControl',
    label: t('Word Rotation'),
    choices: formatSelectOptions(['random', 'flat', 'square']),
    renderTrigger: true,
    default: 'square',
    clearable: false,
    description: t('Rotation to apply to words in the cloud'),
  },

  line_interpolation: {
    type: 'SelectControl',
    label: t('Line Style'),
    renderTrigger: true,
    choices: formatSelectOptions(['linear', 'basis', 'cardinal',
      'monotone', 'step-before', 'step-after']),
    default: 'linear',
    description: t('Line interpolation as defined by d3.js'),
  },

  pie_label_type: {
    type: 'SelectControl',
    label: t('Label Type'),
    default: 'key',
    renderTrigger: true,
    choices: [
      ['key', 'Category Name'],
      ['value', 'Value'],
      ['percent', 'Percentage'],
      ['key_value', 'Category and Value'],
      ['key_percent', 'Category and Percentage'],
    ],
    description: t('What should be shown on the label?'),
  },

  code: {
    type: 'TextAreaControl',
    label: t('Code'),
    description: t('Put your code here'),
    mapStateToProps: state => ({
      language: state.controls && state.controls.markup_type ? state.controls.markup_type.value : 'markdown',
    }),
    default: '',
  },

  pandas_aggfunc: {
    type: 'SelectControl',
    label: t('Aggregation function'),
    clearable: false,
    choices: formatSelectOptions([
      'sum',
      'mean',
      'min',
      'max',
      'std',
      'var',
    ]),
    default: 'sum',
    description: t('Aggregate function to apply when pivoting and ' +
    'computing the total rows and columns'),
  },

  js_agg_function: {
    type: 'SelectControl',
    label: t('Dynamic Aggregation Function'),
    description: t('The function to use when aggregating points into groups'),
    default: 'sum',
    clearable: false,
    renderTrigger: true,
    choices: formatSelectOptions([
      'sum',
      'min',
      'max',
      'mean',
      'median',
      'count',
      'variance',
      'deviation',
      'p1',
      'p5',
      'p95',
      'p99',
    ]),
  },

  size_from: {
    type: 'TextControl',
    isInt: true,
    label: t('Minimum Font Size'),
    renderTrigger: true,
    default: '20',
    description: t('Font size for the smallest value in the list'),
  },

  size_to: {
    type: 'TextControl',
    isInt: true,
    label: t('Maximum Font Size'),
    renderTrigger: true,
    default: '150',
    description: t('Font size for the biggest value in the list'),
  },

  header_font_size: {
    type: 'SelectControl',
    label: t('Header Font Size'),
    renderTrigger: true,
    clearable: false,
    default: 0.3,
    // Values represent the percentage of space a header should take
    options: [
      {
        label: t('Tiny'),
        value: 0.125,
      },
      {
        label: t('Small'),
        value: 0.2,
      },
      {
        label: t('Normal'),
        value: 0.3,
      },
      {
        label: t('Large'),
        value: 0.4,
      },
      {
        label: t('Huge'),
        value: 0.5,
      },
    ],
  },

  subheader_font_size: {
    type: 'SelectControl',
    label: t('Subheader Font Size'),
    renderTrigger: true,
    clearable: false,
    default: 0.125,
    // Values represent the percentage of space a subheader should take
    options: [
      {
        label: t('Tiny'),
        value: 0.125,
      },
      {
        label: t('Small'),
        value: 0.2,
      },
      {
        label: t('Normal'),
        value: 0.3,
      },
      {
        label: t('Large'),
        value: 0.4,
      },
      {
        label: t('Huge'),
        value: 0.5,
      },
    ],
  },

  instant_filtering: {
    type: 'CheckboxControl',
    label: t('Instant Filtering'),
    renderTrigger: true,
    default: true,
    description: (
      'Whether to apply filters as they change, or wait for' +
      'users to hit an [Apply] button'
    ),
  },

  extruded: {
    type: 'CheckboxControl',
    label: t('Extruded'),
    renderTrigger: true,
    default: true,
    description: ('Whether to make the grid 3D'),
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

  date_filter: {
    type: 'CheckboxControl',
    label: t('Date Filter'),
    default: true,
    description: t('Whether to include a time filter'),
  },

  show_sqla_time_granularity: {
    type: 'CheckboxControl',
    label: t('Show SQL Granularity Dropdown'),
    default: false,
    description: t('Check to include SQL Granularity dropdown'),
  },

  show_sqla_time_column: {
    type: 'CheckboxControl',
    label: t('Show SQL Time Column'),
    default: false,
    description: t('Check to include Time Column dropdown'),
  },

  show_druid_time_granularity: {
    type: 'CheckboxControl',
    label: t('Show Druid Granularity Dropdown'),
    default: false,
    description: t('Check to include Druid Granularity dropdown'),
  },

  show_druid_time_origin: {
    type: 'CheckboxControl',
    label: t('Show Druid Time Origin'),
    default: false,
    description: t('Check to include Time Origin dropdown'),
  },

  show_datatable: {
    type: 'CheckboxControl',
    label: t('Data Table'),
    default: false,
    renderTrigger: true,
    description: t('Whether to display the interactive data table'),
  },

  include_search: {
    type: 'CheckboxControl',
    label: t('Search Box'),
    renderTrigger: true,
    default: false,
    description: t('Whether to include a client-side search box'),
  },

  table_filter: {
    type: 'CheckboxControl',
    label: t('Emit Filter Events'),
    renderTrigger: true,
    default: false,
    description: t('Whether to apply filter when items are clicked'),
  },

  align_pn: {
    type: 'CheckboxControl',
    label: t('Align +/-'),
    renderTrigger: true,
    default: false,
    description: t('Whether to align the background chart for +/- values'),
  },

  color_pn: {
    type: 'CheckboxControl',
    label: t('Color +/-'),
    renderTrigger: true,
    default: true,
    description: t('Whether to color +/- values'),
  },

  show_bubbles: {
    type: 'CheckboxControl',
    label: t('Show Bubbles'),
    default: false,
    renderTrigger: true,
    description: t('Whether to display bubbles on top of countries'),
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

  toggle_polygons: {
    type: 'CheckboxControl',
    label: t('Multiple filtering'),
    renderTrigger: true,
    default: true,
    description: t('Allow sending multiple polygons as a filter event'),
  },

  num_buckets: {
    type: 'SelectControl',
    multi: false,
    freeForm: true,
    label: t('Number of buckets to group data'),
    default: 5,
    choices: formatSelectOptions([2, 3, 5, 10]),
    description: t('How many buckets should the data be grouped in.'),
    renderTrigger: true,
  },

  break_points: {
    type: 'SelectControl',
    multi: true,
    freeForm: true,
    label: t('Bucket break points'),
    choices: formatSelectOptions([]),
    description: t('List of n+1 values for bucketing metric into n buckets.'),
    renderTrigger: true,
  },

  show_labels: {
    type: 'CheckboxControl',
    label: t('Show Labels'),
    renderTrigger: true,
    default: true,
    description: t(
      'Whether to display the labels. Note that the label only displays when the the 5% ' +
      'threshold.'),
  },

  show_values: {
    type: 'CheckboxControl',
    label: t('Show Values'),
    renderTrigger: true,
    default: false,
    description: t('Whether to display the numerical values within the cells'),
  },

  show_metric_name: {
    type: 'CheckboxControl',
    label: t('Show Metric Names'),
    renderTrigger: true,
    default: true,
    description: t('Whether to display the metric name as a title'),
  },

  show_trend_line: {
    type: 'CheckboxControl',
    label: t('Show Trend Line'),
    renderTrigger: true,
    default: true,
    description: t('Whether to display the trend line'),
  },

  start_y_axis_at_zero: {
    type: 'CheckboxControl',
    label: t('Start y-axis at 0'),
    renderTrigger: true,
    default: true,
    description: t('Start y-axis at zero. Uncheck to start y-axis at minimum value in the data.'),
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
    description: t('The rich tooltip shows a list of all series for that ' +
    'point in time'),
  },

  y_log_scale: {
    type: 'CheckboxControl',
    label: t('Y Log Scale'),
    default: false,
    renderTrigger: true,
    description: t('Use a log scale for the Y-axis'),
  },

  x_log_scale: {
    type: 'CheckboxControl',
    label: t('X Log Scale'),
    default: false,
    renderTrigger: true,
    description: t('Use a log scale for the X-axis'),
  },

  log_scale: {
    type: 'CheckboxControl',
    label: t('Log Scale'),
    default: false,
    renderTrigger: true,
    description: t('Use a log scale'),
  },

  donut: {
    type: 'CheckboxControl',
    label: t('Donut'),
    default: false,
    renderTrigger: true,
    description: t('Do you want a donut or a pie?'),
  },

  labels_outside: {
    type: 'CheckboxControl',
    label: t('Put labels outside'),
    default: true,
    renderTrigger: true,
    description: t('Put the labels outside the pie?'),
  },

  contribution: {
    type: 'CheckboxControl',
    label: t('Contribution'),
    default: false,
    description: t('Compute the contribution to the total'),
  },

  time_compare: {
    type: 'SelectControl',
    multi: true,
    freeForm: true,
    label: t('Time Shift'),
    choices: formatSelectOptions([
      '1 day',
      '1 week',
      '28 days',
      '30 days',
      '52 weeks',
      '1 year',
    ]),
    description: t('Overlay one or more timeseries from a ' +
    'relative time period. Expects relative time deltas ' +
    'in natural language (example:  24 hours, 7 days, ' +
    '56 weeks, 365 days)'),
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
    description: t('How to display time shifts: as individual lines; as the ' +
    'absolute difference between the main time series and each time shift; ' +
    'as the percentage change; or as the ratio between series and time shifts.'),
  },

  subheader: {
    type: 'TextControl',
    label: t('Subheader'),
    description: t('Description text that shows up below your Big Number'),
  },

  mapbox_label: {
    type: 'SelectControl',
    multi: true,
    label: t('label'),
    default: [],
    description: t('`count` is COUNT(*) if a group by is used. ' +
    'Numerical columns will be aggregated with the aggregator. ' +
    'Non-numerical columns will be used to label points. ' +
    'Leave empty to get a count of points in each cluster.'),
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

  clustering_radius: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Clustering Radius'),
    default: '60',
    choices: formatSelectOptions([
      '0',
      '20',
      '40',
      '60',
      '80',
      '100',
      '200',
      '500',
      '1000',
    ]),
    description: t('The radius (in pixels) the algorithm uses to define a cluster. ' +
    'Choose 0 to turn off clustering, but beware that a large ' +
    'number of points (>1000) will cause lag.'),
  },

  point_radius_fixed: {
    type: 'FixedOrMetricControl',
    label: t('Point Size'),
    default: { type: 'fix', value: 1000 },
    description: t('Fixed point radius'),
    mapStateToProps: state => ({
      datasource: state.datasource,
    }),
  },

  point_radius: {
    type: 'SelectControl',
    label: t('Point Radius'),
    default: 'Auto',
    description: t('The radius of individual points (ones that are not in a cluster). ' +
    'Either a numerical column or `Auto`, which scales the point based ' +
    'on the largest cluster'),
    mapStateToProps: state => ({
      choices: formatSelectOptions(['Auto']).concat(columnChoices(state.datasource)),
    }),
  },

  point_radius_unit: {
    type: 'SelectControl',
    label: t('Point Radius Unit'),
    default: 'Pixels',
    choices: formatSelectOptions(['Pixels', 'Miles', 'Kilometers']),
    description: t('The unit of measure for the specified point radius'),
  },

  point_unit: {
    type: 'SelectControl',
    label: t('Point Unit'),
    default: 'square_m',
    clearable: false,
    choices: [
      ['square_m', 'Square meters'],
      ['square_km', 'Square kilometers'],
      ['square_miles', 'Square miles'],
      ['radius_m', 'Radius in meters'],
      ['radius_km', 'Radius in kilometers'],
      ['radius_miles', 'Radius in miles'],
    ],
    description: t('The unit of measure for the specified point radius'),
  },

  global_opacity: {
    type: 'TextControl',
    label: t('Opacity'),
    default: 1,
    isFloat: true,
    description: t('Opacity of all clusters, points, and labels. ' +
    'Between 0 and 1.'),
  },

  opacity: {
    type: 'SliderControl',
    label: t('Opacity'),
    default: 80,
    step: 1,
    min: 0,
    max: 100,
    renderTrigger: true,
    description: t('Opacity, expects values between 0 and 100'),
  },

  viewport: {
    type: 'ViewportControl',
    label: t('Viewport'),
    renderTrigger: false,
    description: t('Parameters related to the view and perspective on the map'),
    // default is whole world mostly centered
    default: defaultViewport,
    // Viewport changes shouldn't prompt user to re-run query
    dontRefreshOnChange: true,
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

  viewport_latitude: {
    type: 'TextControl',
    label: t('Default latitude'),
    renderTrigger: true,
    default: 37.772123,
    isFloat: true,
    description: t('Latitude of default viewport'),
    places: 8,
    // Viewport latitude changes shouldn't prompt user to re-run query
    dontRefreshOnChange: true,
  },

  viewport_longitude: {
    type: 'TextControl',
    label: t('Default longitude'),
    renderTrigger: true,
    default: -122.405293,
    isFloat: true,
    description: t('Longitude of default viewport'),
    places: 8,
    // Viewport longitude changes shouldn't prompt user to re-run query
    dontRefreshOnChange: true,
  },

  render_while_dragging: {
    type: 'CheckboxControl',
    label: t('Live render'),
    default: true,
    description: t('Points and clusters will update as the viewport is being changed'),
  },

  mapbox_color: {
    type: 'SelectControl',
    freeForm: true,
    label: t('RGB Color'),
    default: 'rgb(0, 122, 135)',
    choices: [
      ['rgb(0, 139, 139)', 'Dark Cyan'],
      ['rgb(128, 0, 128)', 'Purple'],
      ['rgb(255, 215, 0)', 'Gold'],
      ['rgb(69, 69, 69)', 'Dim Gray'],
      ['rgb(220, 20, 60)', 'Crimson'],
      ['rgb(34, 139, 34)', 'Forest Green'],
    ],
    description: t('The color for points and clusters in RGB'),
  },

  color: {
    type: 'ColorPickerControl',
    label: t('Color'),
    default: PRIMARY_COLOR,
    description: t('Pick a color'),
  },

  ranges: {
    type: 'TextControl',
    label: t('Ranges'),
    default: '',
    description: t('Ranges to highlight with shading'),
  },

  range_labels: {
    type: 'TextControl',
    label: t('Range labels'),
    default: '',
    description: t('Labels for the ranges'),
  },

  markers: {
    type: 'TextControl',
    label: t('Markers'),
    default: '',
    description: t('List of values to mark with triangles'),
  },

  marker_labels: {
    type: 'TextControl',
    label: t('Marker labels'),
    default: '',
    description: t('Labels for the markers'),
  },

  marker_lines: {
    type: 'TextControl',
    label: t('Marker lines'),
    default: '',
    description: t('List of values to mark with lines'),
  },

  marker_line_labels: {
    type: 'TextControl',
    label: t('Marker line labels'),
    default: '',
    description: t('Labels for the marker lines'),
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
      columns: state.datasource ? state.datasource.columns.filter(c => c.filterable) : [],
      savedMetrics: state.datasource ? state.datasource.metrics : [],
      datasource: state.datasource,
    }),
    provideFormDataToProps: true,
  },

  filters: {
    type: 'FilterPanel',
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

  order_by_entity: {
    type: 'CheckboxControl',
    label: t('Order by entity id'),
    description: t('Important! Select this if the table is not already sorted by entity id, ' +
    'else there is no guarantee that all events for each entity are returned.'),
    default: true,
  },

  min_leaf_node_event_count: {
    type: 'SelectControl',
    freeForm: false,
    label: t('Minimum leaf node event count'),
    default: 1,
    choices: formatSelectOptionsForRange(1, 10),
    description: t('Leaf nodes that represent fewer than this number of events will be initially ' +
    'hidden in the visualization'),
  },

  color_scheme: {
    type: 'ColorSchemeControl',
    label: t('Color Scheme'),
    default: 'bnbColors',
    renderTrigger: true,
    choices: () => categoricalSchemeRegistry.keys().map(s => ([s, s])),
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

  significance_level: {
    type: 'TextControl',
    label: t('Significance Level'),
    default: 0.05,
    description: t('Threshold alpha level for determining significance'),
  },

  pvalue_precision: {
    type: 'TextControl',
    label: t('p-value precision'),
    default: 6,
    description: t('Number of decimal places with which to display p-values'),
  },

  liftvalue_precision: {
    type: 'TextControl',
    label: t('Lift percent precision'),
    default: 4,
    description: t('Number of decimal places with which to display lift values'),
  },

  column_collection: {
    type: 'CollectionControl',
    label: t('Time Series Columns'),
    validators: [v.nonEmpty],
    controlName: 'TimeSeriesColumnControl',
  },

  rose_area_proportion: {
    type: 'CheckboxControl',
    label: t('Use Area Proportions'),
    description: t(
      'Check if the Rose Chart should use segment area instead of ' +
      'segment radius for proportioning',
    ),
    default: false,
    renderTrigger: true,
  },

  time_series_option: {
    type: 'SelectControl',
    label: t('Options'),
    validators: [v.nonEmpty],
    default: 'not_time',
    valueKey: 'value',
    options: [
      {
        label: t('Not Time Series'),
        value: 'not_time',
        description: t('Ignore time'),
      },
      {
        label: t('Time Series'),
        value: 'time_series',
        description: t('Standard time series'),
      },
      {
        label: t('Aggregate Mean'),
        value: 'agg_mean',
        description: t('Mean of values over specified period'),
      },
      {
        label: t('Aggregate Sum'),
        value: 'agg_sum',
        description: t('Sum of values over specified period'),
      },
      {
        label: t('Difference'),
        value: 'point_diff',
        description: t('Metric change in value from `since` to `until`'),
      },
      {
        label: t('Percent Change'),
        value: 'point_percent',
        description: t('Metric percent change in value from `since` to `until`'),
      },
      {
        label: t('Factor'),
        value: 'point_factor',
        description: t('Metric factor change from `since` to `until`'),
      },
      {
        label: t('Advanced Analytics'),
        value: 'adv_anal',
        description: t('Use the Advanced Analytics options below'),
      },
    ],
    optionRenderer: op => <OptionDescription option={op} />,
    valueRenderer: op => <OptionDescription option={op} />,
    description: t('Settings for time series'),
  },

  equal_date_size: {
    type: 'CheckboxControl',
    label: t('Equal Date Sizes'),
    default: true,
    renderTrigger: true,
    description: t('Check to force date partitions to have the same height'),
  },

  partition_limit: {
    type: 'TextControl',
    label: t('Partition Limit'),
    isInt: true,
    default: '5',
    description:
      t('The maximum number of subdivisions of each group; ' +
      'lower values are pruned first'),
  },

  min_radius: {
    type: 'TextControl',
    label: t('Minimum Radius'),
    isFloat: true,
    validators: [v.nonEmpty],
    renderTrigger: true,
    default: 2,
    description:
    t('Minimum radius size of the circle, in pixels. As the zoom level changes, this ' +
      'insures that the circle respects this minimum radius.'),
  },

  max_radius: {
    type: 'TextControl',
    label: t('Maximum Radius'),
    isFloat: true,
    validators: [v.nonEmpty],
    renderTrigger: true,
    default: 250,
    description:
    t('Maxium radius size of the circle, in pixels. As the zoom level changes, this ' +
      'insures that the circle respects this maximum radius.'),
  },

  partition_threshold: {
    type: 'TextControl',
    label: t('Partition Threshold'),
    isFloat: true,
    default: '0.05',
    description:
      t('Partitions whose height to parent height proportions are ' +
      'below this value are pruned'),
  },

  line_column: {
    type: 'SelectControl',
    label: t('Lines column'),
    default: null,
    description: t('The database columns that contains lines information'),
    mapStateToProps: state => ({
      choices: columnChoices(state.datasource),
    }),
    validators: [v.nonEmpty],
  },
  line_type: {
    type: 'SelectControl',
    label: t('Lines encoding'),
    clearable: false,
    default: 'json',
    description: t('The encoding format of the lines'),
    choices: [
      ['polyline', 'Polyline'],
      ['json', 'JSON'],
      ['geohash', 'geohash (square)'],
    ],
  },

  line_width: {
    type: 'TextControl',
    label: t('Line width'),
    renderTrigger: true,
    isInt: true,
    default: 10,
    description: t('The width of the lines'),
  },

  line_charts: {
    type: 'SelectAsyncControl',
    multi: true,
    label: t('Line charts'),
    validators: [v.nonEmpty],
    default: [],
    description: t('Pick a set of line charts to layer on top of one another'),
    dataEndpoint: '/sliceasync/api/read?_flt_0_viz_type=line&_flt_7_viz_type=line_multi',
    placeholder: t('Select charts'),
    onAsyncErrorMessage: t('Error while fetching charts'),
    mutator: (data) => {
      if (!data || !data.result) {
        return [];
      }
      return data.result.map(o => ({ value: o.id, label: o.slice_name }));
    },
  },

  line_charts_2: {
    type: 'SelectAsyncControl',
    multi: true,
    label: t('Right Axis chart(s)'),
    validators: [],
    default: [],
    description: t('Choose one or more charts for right axis'),
    dataEndpoint: '/sliceasync/api/read?_flt_0_viz_type=line&_flt_7_viz_type=line_multi',
    placeholder: t('Select charts'),
    onAsyncErrorMessage: t('Error while fetching charts'),
    mutator: (data) => {
      if (!data || !data.result) {
        return [];
      }
      return data.result.map(o => ({ value: o.id, label: o.slice_name }));
    },
  },

  prefix_metric_with_slice_name: {
    type: 'CheckboxControl',
    label: t('Prefix metric name with slice name'),
    default: false,
    renderTrigger: true,
  },

  reverse_long_lat: {
    type: 'CheckboxControl',
    label: t('Reverse Lat & Long'),
    default: false,
  },

  deck_slices: {
    type: 'SelectAsyncControl',
    multi: true,
    label: t('deck.gl charts'),
    validators: [v.nonEmpty],
    default: [],
    description: t('Pick a set of deck.gl charts to layer on top of one another'),
    dataEndpoint: '/sliceasync/api/read?_flt_0_viz_type=deck_&_flt_7_viz_type=deck_multi',
    placeholder: t('Select charts'),
    onAsyncErrorMessage: t('Error while fetching charts'),
    mutator: (data) => {
      if (!data || !data.result) {
        return [];
      }
      return data.result.map(o => ({ value: o.id, label: o.slice_name }));
    },
  },

  js_data_mutator: jsFunctionControl(
    t('Javascript data interceptor'),
    t('Define a javascript function that receives the data array used in the visualization ' +
      'and is expected to return a modified version of that array. This can be used ' +
      'to alter properties of the data, filter, or enrich the array.'),
  ),

  js_data: jsFunctionControl(
    t('Javascript data mutator'),
    t('Define a function that receives intercepts the data objects and can mutate it'),
  ),

  js_tooltip: jsFunctionControl(
    t('Javascript tooltip generator'),
    t('Define a function that receives the input and outputs the content for a tooltip'),
  ),

  js_onclick_href: jsFunctionControl(
    t('Javascript onClick href'),
    t('Define a function that returns a URL to navigate to when user clicks'),
  ),

  js_columns: {
    ...groupByControl,
    label: t('Extra data for JS'),
    default: [],
    description: t('List of extra columns made available in Javascript functions'),
  },

  stroked: {
    type: 'CheckboxControl',
    label: t('Stroked'),
    renderTrigger: true,
    description: t('Whether to display the stroke'),
    default: false,
  },

  filled: {
    type: 'CheckboxControl',
    label: t('Filled'),
    renderTrigger: true,
    description: t('Whether to fill the objects'),
    default: true,
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

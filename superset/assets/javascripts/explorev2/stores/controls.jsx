import { formatSelectOptionsForRange, formatSelectOptions } from '../../modules/utils';
import React from 'react';
import visTypes from './visTypes';
import * as v from '../validators';

const D3_FORMAT_DOCS = 'D3 format syntax: https://github.com/d3/d3-format';

// input choices & options
const D3_TIME_FORMAT_OPTIONS = [
  ['.3s', '.3s | 12.3k'],
  ['.3%', '.3% | 1234543.210%'],
  ['.4r', '.4r | 12350'],
  ['.3f', '.3f | 12345.432'],
  ['+,', '+, | +12,345.4321'],
  ['$,.2f', '$,.2f | $12,345.43'],
];

const ROW_LIMIT_OPTIONS = [10, 50, 100, 250, 500, 1000, 5000, 10000, 50000];

const SERIES_LIMITS = [0, 5, 10, 25, 50, 100, 500];

export const TIME_STAMP_OPTIONS = [
  ['smart_date', 'Adaptative formating'],
  ['%m/%d/%Y', '%m/%d/%Y | 01/14/2019'],
  ['%Y-%m-%d', '%Y-%m-%d | 2019-01-14'],
  ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M:%S | 2019-01-14 01:32:10'],
  ['%H:%M:%S', '%H:%M:%S | 01:32:10'],
];

export const controls = {
  datasource: {
    type: 'SelectControl',
    label: 'Datasource',
    isLoading: true,
    clearable: false,
    default: null,
    mapStateToProps: (state) => {
      const datasources = state.datasources || [];
      return {
        choices: datasources,
        isLoading: datasources.length === 0,
        rightNode: state.datasource ?
          <a href={state.datasource.edit_url}>edit</a>
          : null,
      };
    },
    description: '',
  },

  viz_type: {
    type: 'SelectControl',
    label: 'Visualization Type',
    clearable: false,
    default: 'table',
    choices: Object.keys(visTypes).map(vt => [
      vt,
      visTypes[vt].label,
      `/static/assets/images/viz_thumbnails/${vt}.png`,
    ]),
    description: 'The type of visualization to display',
  },

  metrics: {
    type: 'SelectControl',
    multi: true,
    label: 'Metrics',
    validators: [v.nonEmpty],
    default: control =>
      control.choices && control.choices.length > 0 ? [control.choices[0][0]] : null,
    mapStateToProps: (state) => ({
      choices: (state.datasource) ? state.datasource.metrics_combo : [],
    }),
    description: 'One or many metrics to display',
  },

  order_by_cols: {
    type: 'SelectControl',
    multi: true,
    label: 'Ordering',
    default: [],
    description: 'One or many metrics to display',
    mapStateToProps: (state) => ({
      choices: (state.datasource) ? state.datasource.order_by_choices : [],
    }),
  },

  metric: {
    type: 'SelectControl',
    label: 'Metric',
    clearable: false,
    description: 'Choose the metric',
    default: control =>
      control.choices && control.choices.length > 0 ? control.choices[0][0] : null,
    mapStateToProps: (state) => ({
      choices: (state.datasource) ? state.datasource.metrics_combo : null,
    }),
  },

  metric_2: {
    type: 'SelectControl',
    label: 'Right Axis Metric',
    choices: [],
    default: [],
    description: 'Choose a metric for right axis',
    mapStateToProps: (state) => ({
      choices: (state.datasource) ? state.datasource.metrics_combo : [],
    }),
  },

  stacked_style: {
    type: 'SelectControl',
    label: 'Stacked Style',
    choices: [
      ['stack', 'stack'],
      ['stream', 'stream'],
      ['expand', 'expand'],
    ],
    default: 'stack',
    description: '',
  },

  linear_color_scheme: {
    type: 'SelectControl',
    label: 'Linear Color Scheme',
    choices: [
      ['fire', 'fire'],
      ['blue_white_yellow', 'blue/white/yellow'],
      ['white_black', 'white/black'],
      ['black_white', 'black/white'],
    ],
    default: 'blue_white_yellow',
    description: '',
  },

  normalize_across: {
    type: 'SelectControl',
    label: 'Normalize Across',
    choices: [
      ['heatmap', 'heatmap'],
      ['x', 'x'],
      ['y', 'y'],
    ],
    default: 'heatmap',
    description: 'Color will be rendered based on a ratio ' +
                 'of the cell against the sum of across this ' +
                 'criteria',
  },

  horizon_color_scale: {
    type: 'SelectControl',
    label: 'Horizon Color Scale',
    choices: [
      ['series', 'series'],
      ['overall', 'overall'],
      ['change', 'change'],
    ],
    default: 'series',
    description: 'Defines how the color are attributed.',
  },

  canvas_image_rendering: {
    type: 'SelectControl',
    label: 'Rendering',
    choices: [
      ['pixelated', 'pixelated (Sharp)'],
      ['auto', 'auto (Smooth)'],
    ],
    default: 'pixelated',
    description: 'image-rendering CSS attribute of the canvas object that ' +
                 'defines how the browser scales up the image',
  },

  xscale_interval: {
    type: 'SelectControl',
    label: 'XScale Interval',
    choices: formatSelectOptionsForRange(1, 50),
    default: '1',
    description: 'Number of steps to take between ticks when ' +
                 'displaying the X scale',
  },

  yscale_interval: {
    type: 'SelectControl',
    label: 'YScale Interval',
    choices: formatSelectOptionsForRange(1, 50),
    default: null,
    description: 'Number of steps to take between ticks when ' +
                 'displaying the Y scale',
  },

  include_time: {
    type: 'CheckboxControl',
    label: 'Include Time',
    description: 'Whether to include the time granularity as defined in the time section',
    default: false,
  },

  bar_stacked: {
    type: 'CheckboxControl',
    label: 'Stacked Bars',
    renderTrigger: true,
    default: false,
    description: null,
  },

  show_markers: {
    type: 'CheckboxControl',
    label: 'Show Markers',
    renderTrigger: true,
    default: false,
    description: 'Show data points as circle markers on the lines',
  },

  show_bar_value: {
    type: 'CheckboxControl',
    label: 'Bar Values',
    default: false,
    renderTrigger: true,
    description: 'Show the value on top of the bar',
  },

  order_bars: {
    type: 'CheckboxControl',
    label: 'Sort Bars',
    default: false,
    description: 'Sort bars by x labels.',
  },

  show_controls: {
    type: 'CheckboxControl',
    label: 'Extra Controls',
    renderTrigger: true,
    default: false,
    description: 'Whether to show extra controls or not. Extra controls ' +
                 'include things like making mulitBar charts stacked ' +
                 'or side by side.',
  },

  reduce_x_ticks: {
    type: 'CheckboxControl',
    label: 'Reduce X ticks',
    renderTrigger: true,
    default: false,
    description: 'Reduces the number of X axis ticks to be rendered. ' +
                 'If true, the x axis wont overflow and labels may be ' +
                 'missing. If false, a minimum width will be applied ' +
                 'to columns and the width may overflow into an ' +
                 'horizontal scroll.',
  },

  include_series: {
    type: 'CheckboxControl',
    label: 'Include Series',
    renderTrigger: true,
    default: false,
    description: 'Include series name as an axis',
  },

  secondary_metric: {
    type: 'SelectControl',
    label: 'Color Metric',
    default: null,
    description: 'A metric to use for color',
    mapStateToProps: (state) => ({
      choices: (state.datasource) ? state.datasource.metrics_combo : [],
    }),
  },

  country_fieldtype: {
    type: 'SelectControl',
    label: 'Country Field Type',
    default: 'cca2',
    choices: [
        ['name', 'Full name'],
        ['cioc', 'code International Olympic Committee (cioc)'],
        ['cca2', 'code ISO 3166-1 alpha-2 (cca2)'],
        ['cca3', 'code ISO 3166-1 alpha-3 (cca3)'],
    ],
    description: 'The country code standard that Superset should expect ' +
                 'to find in the [country] column',
  },

  groupby: {
    type: 'SelectControl',
    multi: true,
    label: 'Group by',
    default: [],
    description: 'One or many controls to group by',
    mapStateToProps: (state) => ({
      choices: (state.datasource) ? state.datasource.gb_cols : [],
    }),
  },

  columns: {
    type: 'SelectControl',
    multi: true,
    label: 'Columns',
    mapStateToProps: (state) => ({
      choices: (state.datasource) ? state.datasource.gb_cols : [],
    }),
    default: [],
    description: 'One or many controls to pivot as columns',
  },

  all_columns: {
    type: 'SelectControl',
    multi: true,
    label: 'Columns',
    default: [],
    description: 'Columns to display',
    mapStateToProps: (state) => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
  },

  all_columns_x: {
    type: 'SelectControl',
    label: 'X',
    default: null,
    description: 'Columns to display',
    mapStateToProps: (state) => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
  },

  all_columns_y: {
    type: 'SelectControl',
    label: 'Y',
    default: null,
    description: 'Columns to display',
    mapStateToProps: (state) => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
  },

  druid_time_origin: {
    type: 'SelectControl',
    freeForm: true,
    label: 'Origin',
    choices: [
      ['', 'default'],
      ['now', 'now'],
    ],
    default: null,
    description: 'Defines the origin where time buckets start, ' +
                 'accepts natural dates as in `now`, `sunday` or `1970-01-01`',
  },

  bottom_margin: {
    type: 'SelectControl',
    freeForm: true,
    label: 'Bottom Margin',
    choices: formatSelectOptions(['auto', 50, 75, 100, 125, 150, 200]),
    default: 'auto',
    description: 'Bottom marging, in pixels, allowing for more room for axis labels',
  },

  granularity: {
    type: 'SelectControl',
    freeForm: true,
    label: 'Time Granularity',
    default: 'one day',
    choices: formatSelectOptions([
      'all',
      '5 seconds',
      '30 seconds',
      '1 minute',
      '5 minutes',
      '1 hour',
      '6 hour',
      '1 day',
      '7 days',
      'week',
      'week_starting_sunday',
      'week_ending_saturday',
      'month',
    ]),
    description: 'The time granularity for the visualization. Note that you ' +
                 'can type and use simple natural language as in `10 seconds`, ' +
                 '`1 day` or `56 weeks`',
  },

  domain_granularity: {
    type: 'SelectControl',
    label: 'Domain',
    default: 'month',
    choices: formatSelectOptions(['hour', 'day', 'week', 'month', 'year']),
    description: 'The time unit used for the grouping of blocks',
  },

  subdomain_granularity: {
    type: 'SelectControl',
    label: 'Subdomain',
    default: 'day',
    choices: formatSelectOptions(['min', 'hour', 'day', 'week', 'month']),
    description: 'The time unit for each block. Should be a smaller unit than ' +
                 'domain_granularity. Should be larger or equal to Time Grain',
  },

  link_length: {
    type: 'SelectControl',
    freeForm: true,
    label: 'Link Length',
    default: '200',
    choices: formatSelectOptions(['10', '25', '50', '75', '100', '150', '200', '250']),
    description: 'Link length in the force layout',
  },

  charge: {
    type: 'SelectControl',
    freeForm: true,
    label: 'Charge',
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
    description: 'Charge in the force layout',
  },

  granularity_sqla: {
    type: 'SelectControl',
    label: 'Time Column',
    default: control =>
      control.choices && control.choices.length > 0 ? control.choices[0][0] : null,
    description: 'The time column for the visualization. Note that you ' +
                 'can define arbitrary expression that return a DATETIME ' +
                 'column in the table or. Also note that the ' +
                 'filter below is applied against this column or ' +
                 'expression',
    mapStateToProps: (state) => ({
      choices: (state.datasource) ? state.datasource.granularity_sqla : [],
    }),
  },

  time_grain_sqla: {
    type: 'SelectControl',
    label: 'Time Grain',
    default: control => control.choices && control.choices.length ? control.choices[0][0] : null,
    description: 'The time granularity for the visualization. This ' +
                 'applies a date transformation to alter ' +
                 'your time column and defines a new time granularity. ' +
                 'The options here are defined on a per database ' +
                 'engine basis in the Superset source code.',
    mapStateToProps: (state) => ({
      choices: (state.datasource) ? state.datasource.time_grain_sqla : null,
    }),
  },

  resample_rule: {
    type: 'SelectControl',
    freeForm: true,
    label: 'Resample Rule',
    default: null,
    choices: formatSelectOptions(['', '1T', '1H', '1D', '7D', '1M', '1AS']),
    description: 'Pandas resample rule',
  },

  resample_how: {
    type: 'SelectControl',
    freeForm: true,
    label: 'Resample How',
    default: null,
    choices: formatSelectOptions(['', 'mean', 'sum', 'median']),
    description: 'Pandas resample how',
  },

  resample_fillmethod: {
    type: 'SelectControl',
    freeForm: true,
    label: 'Resample Fill Method',
    default: null,
    choices: formatSelectOptions(['', 'ffill', 'bfill']),
    description: 'Pandas resample fill method',
  },

  since: {
    type: 'SelectControl',
    freeForm: true,
    label: 'Since',
    default: '7 days ago',
    choices: formatSelectOptions([
      '1 hour ago',
      '12 hours ago',
      '1 day ago',
      '7 days ago',
      '28 days ago',
      '90 days ago',
      '1 year ago',
      '100 year ago',
    ]),
    description: 'Timestamp from filter. This supports free form typing and ' +
                 'natural language as in `1 day ago`, `28 days` or `3 years`',
  },

  until: {
    type: 'SelectControl',
    freeForm: true,
    label: 'Until',
    default: 'now',
    choices: formatSelectOptions([
      'now',
      '1 day ago',
      '7 days ago',
      '28 days ago',
      '90 days ago',
      '1 year ago',
    ]),
  },

  max_bubble_size: {
    type: 'SelectControl',
    freeForm: true,
    label: 'Max Bubble Size',
    default: '25',
    choices: formatSelectOptions(['5', '10', '15', '25', '50', '75', '100']),
  },

  whisker_options: {
    type: 'SelectControl',
    freeForm: true,
    label: 'Whisker/outlier options',
    default: 'Tukey',
    description: 'Determines how whiskers and outliers are calculated.',
    choices: formatSelectOptions([
      'Tukey',
      'Min/max (no outliers)',
      '2/98 percentiles',
      '9/91 percentiles',
    ]),
  },

  treemap_ratio: {
    type: 'TextControl',
    label: 'Ratio',
    isFloat: true,
    default: 0.5 * (1 + Math.sqrt(5)),  // d3 default, golden ratio
    description: 'Target aspect ratio for treemap tiles.',
  },

  number_format: {
    type: 'SelectControl',
    freeForm: true,
    label: 'Number format',
    default: D3_TIME_FORMAT_OPTIONS[0],
    choices: D3_TIME_FORMAT_OPTIONS,
    description: D3_FORMAT_DOCS,
  },

  row_limit: {
    type: 'SelectControl',
    freeForm: true,
    label: 'Row limit',
    default: null,
    choices: formatSelectOptions(ROW_LIMIT_OPTIONS),
  },

  limit: {
    type: 'SelectControl',
    freeForm: true,
    label: 'Series limit',
    choices: formatSelectOptions(SERIES_LIMITS),
    default: 50,
    description: 'Limits the number of time series that get displayed',
  },

  timeseries_limit_metric: {
    type: 'SelectControl',
    label: 'Sort By',
    default: null,
    description: 'Metric used to define the top series',
    mapStateToProps: (state) => ({
      choices: (state.datasource) ? state.datasource.metrics_combo : [],
    }),
  },

  rolling_type: {
    type: 'SelectControl',
    label: 'Rolling',
    default: 'None',
    choices: formatSelectOptions(['None', 'mean', 'sum', 'std', 'cumsum']),
    description: 'Defines a rolling window function to apply, works along ' +
                 'with the [Periods] text box',
  },

  rolling_periods: {
    type: 'TextControl',
    label: 'Periods',
    isInt: true,
    description: 'Defines the size of the rolling window function, ' +
                 'relative to the time granularity selected',
  },

  series: {
    type: 'SelectControl',
    label: 'Series',
    default: null,
    description: 'Defines the grouping of entities. ' +
                 'Each series is shown as a specific color on the chart and ' +
                 'has a legend toggle',
    mapStateToProps: (state) => ({
      choices: (state.datasource) ? state.datasource.gb_cols : [],
    }),
  },

  entity: {
    type: 'SelectControl',
    label: 'Entity',
    default: null,
    description: 'This define the element to be plotted on the chart',
    mapStateToProps: (state) => ({
      choices: (state.datasource) ? state.datasource.gb_cols : [],
    }),
  },

  x: {
    type: 'SelectControl',
    label: 'X Axis',
    default: null,
    description: 'Metric assigned to the [X] axis',
    mapStateToProps: (state) => ({
      choices: (state.datasource) ? state.datasource.metrics_combo : [],
    }),
  },

  y: {
    type: 'SelectControl',
    label: 'Y Axis',
    default: null,
    description: 'Metric assigned to the [Y] axis',
    mapStateToProps: (state) => ({
      choices: (state.datasource) ? state.datasource.metrics_combo : [],
    }),
  },

  size: {
    type: 'SelectControl',
    label: 'Bubble Size',
    default: null,
    mapStateToProps: (state) => ({
      choices: (state.datasource) ? state.datasource.metrics_combo : [],
    }),
  },

  url: {
    type: 'TextControl',
    label: 'URL',
    description: 'The URL, this control is templated, so you can integrate ' +
                 '{{ width }} and/or {{ height }} in your URL string.',
    default: 'https: //www.youtube.com/embed/JkI5rg_VcQ4',
  },

  x_axis_label: {
    type: 'TextControl',
    label: 'X Axis Label',
    renderTrigger: true,
    default: '',
  },

  y_axis_label: {
    type: 'TextControl',
    label: 'Y Axis Label',
    renderTrigger: true,
    default: '',
  },

  where: {
    type: 'TextControl',
    label: 'Custom WHERE clause',
    default: '',
    description: 'The text in this box gets included in your query\'s WHERE ' +
                 'clause, as an AND to other criteria. You can include ' +
                 'complex expression, parenthesis and anything else ' +
                 'supported by the backend it is directed towards.',
  },

  having: {
    type: 'TextControl',
    label: 'Custom HAVING clause',
    default: '',
    description: 'The text in this box gets included in your query\'s HAVING ' +
                 'clause, as an AND to other criteria. You can include ' +
                 'complex expression, parenthesis and anything else ' +
                 'supported by the backend it is directed towards.',
  },

  compare_lag: {
    type: 'TextControl',
    label: 'Comparison Period Lag',
    isInt: true,
    description: 'Based on granularity, number of time periods to compare against',
  },

  compare_suffix: {
    type: 'TextControl',
    label: 'Comparison suffix',
    description: 'Suffix to apply after the percentage display',
  },

  table_timestamp_format: {
    type: 'SelectControl',
    freeForm: true,
    label: 'Table Timestamp Format',
    default: 'smart_date',
    choices: TIME_STAMP_OPTIONS,
    description: 'Timestamp Format',
  },

  series_height: {
    type: 'SelectControl',
    freeForm: true,
    label: 'Series Height',
    default: '25',
    choices: formatSelectOptions(['10', '25', '40', '50', '75', '100', '150', '200']),
    description: 'Pixel height of each series',
  },

  page_length: {
    type: 'SelectControl',
    freeForm: true,
    label: 'Page Length',
    default: 0,
    choices: formatSelectOptions([0, 10, 25, 40, 50, 75, 100, 150, 200]),
    description: 'Rows per page, 0 means no pagination',
  },

  x_axis_format: {
    type: 'SelectControl',
    freeForm: true,
    label: 'X axis format',
    renderTrigger: true,
    default: 'smart_date',
    choices: TIME_STAMP_OPTIONS,
    description: D3_FORMAT_DOCS,
  },

  y_axis_format: {
    type: 'SelectControl',
    freeForm: true,
    label: 'Y axis format',
    renderTrigger: true,
    default: '.3s',
    choices: D3_TIME_FORMAT_OPTIONS,
    description: D3_FORMAT_DOCS,
  },

  y_axis_2_format: {
    type: 'SelectControl',
    freeForm: true,
    label: 'Right axis format',
    default: '.3s',
    choices: D3_TIME_FORMAT_OPTIONS,
    description: D3_FORMAT_DOCS,
  },

  markup_type: {
    type: 'SelectControl',
    label: 'Markup Type',
    choices: formatSelectOptions(['markdown', 'html']),
    default: 'markdown',
    description: 'Pick your favorite markup language',
  },

  rotation: {
    type: 'SelectControl',
    label: 'Rotation',
    choices: formatSelectOptions(['random', 'flat', 'square']),
    default: 'random',
    description: 'Rotation to apply to words in the cloud',
  },

  line_interpolation: {
    type: 'SelectControl',
    label: 'Line Style',
    renderTrigger: true,
    choices: formatSelectOptions(['linear', 'basis', 'cardinal',
      'monotone', 'step-before', 'step-after']),
    default: 'linear',
    description: 'Line interpolation as defined by d3.js',
  },

  pie_label_type: {
    type: 'SelectControl',
    label: 'Label Type',
    default: 'key',
    choices: [
      ['key', 'Category Name'],
      ['value', 'Value'],
      ['percent', 'Percentage'],
    ],
    description: 'What should be shown on the label?',
  },

  code: {
    type: 'TextAreaControl',
    label: 'Code',
    description: 'Put your code here',
    default: '',
  },

  pandas_aggfunc: {
    type: 'SelectControl',
    label: 'Aggregation function',
    clearable: false,
    choices: formatSelectOptions([
      'sum',
      'mean',
      'min',
      'max',
      'median',
      'stdev',
      'var',
    ]),
    default: 'sum',
    description: 'Aggregate function to apply when pivoting and ' +
                 'computing the total rows and columns',
  },

  size_from: {
    type: 'TextControl',
    isInt: true,
    label: 'Font Size From',
    default: '20',
    description: 'Font size for the smallest value in the list',
  },

  size_to: {
    type: 'TextControl',
    isInt: true,
    label: 'Font Size To',
    default: '150',
    description: 'Font size for the biggest value in the list',
  },

  instant_filtering: {
    type: 'CheckboxControl',
    label: 'Instant Filtering',
    renderTrigger: true,
    default: true,
    description: (
      'Whether to apply filters as they change, or wait for' +
      'users to hit an [Apply] button'
    ),
  },

  show_brush: {
    type: 'CheckboxControl',
    label: 'Range Filter',
    renderTrigger: true,
    default: false,
    description: 'Whether to display the time range interactive selector',
  },

  date_filter: {
    type: 'CheckboxControl',
    label: 'Date Filter',
    default: false,
    description: 'Whether to include a time filter',
  },

  show_datatable: {
    type: 'CheckboxControl',
    label: 'Data Table',
    default: false,
    description: 'Whether to display the interactive data table',
  },

  include_search: {
    type: 'CheckboxControl',
    label: 'Search Box',
    renderTrigger: true,
    default: false,
    description: 'Whether to include a client side search box',
  },

  table_filter: {
    type: 'CheckboxControl',
    label: 'Table Filter',
    default: false,
    description: 'Whether to apply filter when table cell is clicked',
  },

  show_bubbles: {
    type: 'CheckboxControl',
    label: 'Show Bubbles',
    default: false,
    renderTrigger: true,
    description: 'Whether to display bubbles on top of countries',
  },

  show_legend: {
    type: 'CheckboxControl',
    label: 'Legend',
    renderTrigger: true,
    default: true,
    description: 'Whether to display the legend (toggles)',
  },

  x_axis_showminmax: {
    type: 'CheckboxControl',
    label: 'X bounds',
    renderTrigger: true,
    default: true,
    description: 'Whether to display the min and max values of the X axis',
  },

  rich_tooltip: {
    type: 'CheckboxControl',
    label: 'Rich Tooltip',
    renderTrigger: true,
    default: true,
    description: 'The rich tooltip shows a list of all series for that ' +
                 'point in time',
  },

  y_axis_zero: {
    type: 'CheckboxControl',
    label: 'Y Axis Zero',
    default: false,
    renderTrigger: true,
    description: 'Force the Y axis to start at 0 instead of the minimum value',
  },

  y_log_scale: {
    type: 'CheckboxControl',
    label: 'Y Log Scale',
    default: false,
    renderTrigger: true,
    description: 'Use a log scale for the Y axis',
  },

  x_log_scale: {
    type: 'CheckboxControl',
    label: 'X Log Scale',
    default: false,
    renderTrigger: true,
    description: 'Use a log scale for the X axis',
  },

  donut: {
    type: 'CheckboxControl',
    label: 'Donut',
    default: false,
    description: 'Do you want a donut or a pie?',
  },

  labels_outside: {
    type: 'CheckboxControl',
    label: 'Put labels outside',
    default: true,
    description: 'Put the labels outside the pie?',
  },

  contribution: {
    type: 'CheckboxControl',
    label: 'Contribution',
    default: false,
    description: 'Compute the contribution to the total',
  },

  num_period_compare: {
    type: 'TextControl',
    label: 'Period Ratio',
    default: '',
    isInt: true,
    description: '[integer] Number of period to compare against, ' +
                 'this is relative to the granularity selected',
  },

  period_ratio_type: {
    type: 'SelectControl',
    label: 'Period Ratio Type',
    default: 'growth',
    choices: formatSelectOptions(['factor', 'growth', 'value']),
    description: '`factor` means (new/previous), `growth` is ' +
                 '((new/previous) - 1), `value` is (new-previous)',
  },

  time_compare: {
    type: 'TextControl',
    label: 'Time Shift',
    default: null,
    description: 'Overlay a timeseries from a ' +
                 'relative time period. Expects relative time delta ' +
                 'in natural language (example:  24 hours, 7 days, ' +
                 '56 weeks, 365 days',
  },

  subheader: {
    type: 'TextControl',
    label: 'Subheader',
    description: 'Description text that shows up below your Big Number',
  },

  mapbox_label: {
    type: 'SelectControl',
    multi: true,
    label: 'label',
    default: [],
    description: '`count` is COUNT(*) if a group by is used. ' +
                 'Numerical columns will be aggregated with the aggregator. ' +
                 'Non-numerical columns will be used to label points. ' +
                 'Leave empty to get a count of points in each cluster.',
    mapStateToProps: (state) => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
  },

  mapbox_style: {
    type: 'SelectControl',
    label: 'Map Style',
    choices: [
        ['mapbox://styles/mapbox/streets-v9', 'Streets'],
        ['mapbox://styles/mapbox/dark-v9', 'Dark'],
        ['mapbox://styles/mapbox/light-v9', 'Light'],
        ['mapbox://styles/mapbox/satellite-streets-v9', 'Satellite Streets'],
        ['mapbox://styles/mapbox/satellite-v9', 'Satellite'],
        ['mapbox://styles/mapbox/outdoors-v9', 'Outdoors'],
    ],
    default: 'mapbox://styles/mapbox/streets-v9',
    description: 'Base layer map style',
  },

  clustering_radius: {
    type: 'SelectControl',
    freeForm: true,
    label: 'Clustering Radius',
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
    description: 'The radius (in pixels) the algorithm uses to define a cluster. ' +
                 'Choose 0 to turn off clustering, but beware that a large ' +
                 'number of points (>1000) will cause lag.',
  },

  point_radius: {
    type: 'SelectControl',
    label: 'Point Radius',
    default: 'Auto',
    description: 'The radius of individual points (ones that are not in a cluster). ' +
                 'Either a numerical column or `Auto`, which scales the point based ' +
                 'on the largest cluster',
    mapStateToProps: (state) => ({
      choices: [].concat([['Auto', 'Auto']], state.datasource.all_cols),
    }),
  },

  point_radius_unit: {
    type: 'SelectControl',
    label: 'Point Radius Unit',
    default: 'Pixels',
    choices: formatSelectOptions(['Pixels', 'Miles', 'Kilometers']),
    description: 'The unit of measure for the specified point radius',
  },

  global_opacity: {
    type: 'TextControl',
    label: 'Opacity',
    default: 1,
    isFloat: true,
    description: 'Opacity of all clusters, points, and labels. ' +
                 'Between 0 and 1.',
  },

  viewport_zoom: {
    type: 'TextControl',
    label: 'Zoom',
    isFloat: true,
    default: 11,
    description: 'Zoom level of the map',
    places: 8,
  },

  viewport_latitude: {
    type: 'TextControl',
    label: 'Default latitude',
    default: 37.772123,
    isFloat: true,
    description: 'Latitude of default viewport',
    places: 8,
  },

  viewport_longitude: {
    type: 'TextControl',
    label: 'Default longitude',
    default: -122.405293,
    isFloat: true,
    description: 'Longitude of default viewport',
    places: 8,
  },

  render_while_dragging: {
    type: 'CheckboxControl',
    label: 'Live render',
    default: true,
    description: 'Points and clusters will update as viewport is being changed',
  },

  mapbox_color: {
    type: 'SelectControl',
    freeForm: true,
    label: 'RGB Color',
    default: 'rgb(0, 122, 135)',
    choices: [
      ['rgb(0, 139, 139)', 'Dark Cyan'],
      ['rgb(128, 0, 128)', 'Purple'],
      ['rgb(255, 215, 0)', 'Gold'],
      ['rgb(69, 69, 69)', 'Dim Gray'],
      ['rgb(220, 20, 60)', 'Crimson'],
      ['rgb(34, 139, 34)', 'Forest Green'],
    ],
    description: 'The color for points and clusters in RGB',
  },

  ranges: {
    type: 'TextControl',
    label: 'Ranges',
    default: '',
    description: 'Ranges to highlight with shading',
  },

  range_labels: {
    type: 'TextControl',
    label: 'Range labels',
    default: '',
    description: 'Labels for the ranges',
  },

  markers: {
    type: 'TextControl',
    label: 'Markers',
    default: '',
    description: 'List of values to mark with triangles',
  },

  marker_labels: {
    type: 'TextControl',
    label: 'Marker labels',
    default: '',
    description: 'Labels for the markers',
  },

  marker_lines: {
    type: 'TextControl',
    label: 'Marker lines',
    default: '',
    description: 'List of values to mark with lines',
  },

  marker_line_labels: {
    type: 'TextControl',
    label: 'Marker line labels',
    default: '',
    description: 'Labels for the marker lines',
  },

  filters: {
    type: 'FilterControl',
    label: '',
    default: [],
    description: '',
    mapStateToProps: (state) => ({
      choices: (state.datasource) ? state.datasource.filterable_cols : [],
      datasource: state.datasource,
    }),
  },

  having_filters: {
    type: 'FilterControl',
    label: '',
    default: [],
    description: '',
    mapStateToProps: (state) => ({
      choices: (state.datasource) ? state.datasource.metrics_combo
        .concat(state.datasource.filterable_cols) : [],
      datasource: state.datasource,
    }),
  },

  slice_id: {
    type: 'HiddenControl',
    label: 'Slice ID',
    hidden: true,
    description: 'The id of the active slice',
  },
};
export default controls;

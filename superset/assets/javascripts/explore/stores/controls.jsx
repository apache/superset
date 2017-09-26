import React from 'react';
import { formatSelectOptionsForRange, formatSelectOptions } from '../../modules/utils';
import * as v from '../validators';
import { ALL_COLOR_SCHEMES, spectrums } from '../../modules/colors';
import MetricOption from '../../components/MetricOption';
import ColumnOption from '../../components/ColumnOption';
import OptionDescription from '../../components/OptionDescription';
import { t } from '../../locales';

const D3_FORMAT_DOCS = 'D3 format syntax: https://github.com/d3/d3-format';

// input choices & options
const D3_FORMAT_OPTIONS = [
  ['.3s', '.3s | 12.3k'],
  ['.3%', '.3% | 1234543.210%'],
  ['.4r', '.4r | 12350'],
  ['.3f', '.3f | 12345.432'],
  ['+,', '+, | +12,345.4321'],
  ['$,.2f', '$,.2f | $12,345.43'],
];

const ROW_LIMIT_OPTIONS = [10, 50, 100, 250, 500, 1000, 5000, 10000, 50000];

const SERIES_LIMITS = [0, 5, 10, 25, 50, 100, 500];

export const D3_TIME_FORMAT_OPTIONS = [
  ['smart_date', 'Adaptative formating'],
  ['%m/%d/%Y', '%m/%d/%Y | 01/14/2019'],
  ['%Y-%m-%d', '%Y-%m-%d | 2019-01-14'],
  ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M:%S | 2019-01-14 01:32:10'],
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
  label: t('Group by'),
  default: [],
  includeTime: false,
  description: t('One or many controls to group by'),
  optionRenderer: c => <ColumnOption column={c} />,
  valueRenderer: c => <ColumnOption column={c} />,
  valueKey: 'column_name',
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

export const controls = {
  datasource: {
    type: 'DatasourceControl',
    label: t('Datasource'),
    default: null,
    description: null,
    mapStateToProps: state => ({
      datasource: state.datasource,
    }),
  },

  viz_type: {
    type: 'VizTypeControl',
    label: t('Visualization Type'),
    default: 'table',
    description: t('The type of visualization to display'),
  },

  metrics: {
    type: 'SelectControl',
    multi: true,
    label: t('Metrics'),
    validators: [v.nonEmpty],
    valueKey: 'metric_name',
    optionRenderer: m => <MetricOption metric={m} />,
    valueRenderer: m => <MetricOption metric={m} />,
    default: c => c.options && c.options.length > 0 ? [c.options[0].metric_name] : null,
    mapStateToProps: state => ({
      options: (state.datasource) ? state.datasource.metrics : [],
    }),
    description: t('One or many metrics to display'),
  },

  percent_metrics: {
    type: 'SelectControl',
    multi: true,
    label: t('Percentage Metrics'),
    valueKey: 'metric_name',
    optionRenderer: m => <MetricOption metric={m} />,
    valueRenderer: m => <MetricOption metric={m} />,
    mapStateToProps: state => ({
      options: (state.datasource) ? state.datasource.metrics : [],
    }),
    description: t('Metrics for which percentage of total are to be displayed'),
  },

  y_axis_bounds: {
    type: 'BoundsControl',
    label: t('Y Axis Bounds'),
    renderTrigger: true,
    default: [null, null],
    description: t('Bounds for the Y axis. When left empty, the bounds are ' +
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

  annotation_layers: {
    type: 'SelectAsyncControl',
    multi: true,
    label: t('Annotation Layers'),
    default: [],
    description: t('Annotation layers to overlay on the visualization'),
    dataEndpoint: '/annotationlayermodelview/api/read?',
    placeholder: t('Select a annotation layer'),
    onAsyncErrorMessage: t('Error while fetching annotation layers'),
    mutator: (data) => {
      if (!data || !data.result) {
        return [];
      }
      return data.result.map(layer => ({ value: layer.id, label: layer.name }));
    },
  },

  metric: {
    type: 'SelectControl',
    label: t('Metric'),
    clearable: false,
    description: t('Choose the metric'),
    validators: [v.nonEmpty],
    optionRenderer: m => <MetricOption metric={m} />,
    valueRenderer: m => <MetricOption metric={m} />,
    default: c => c.options && c.options.length > 0 ? c.options[0].metric_name : null,
    valueKey: 'metric_name',
    mapStateToProps: state => ({
      options: (state.datasource) ? state.datasource.metrics : [],
    }),
  },

  metric_2: {
    type: 'SelectControl',
    label: t('Right Axis Metric'),
    default: null,
    validators: [v.nonEmpty],
    clearable: true,
    description: t('Choose a metric for right axis'),
    valueKey: 'metric_name',
    optionRenderer: m => <MetricOption metric={m} />,
    valueRenderer: m => <MetricOption metric={m} />,
    mapStateToProps: state => ({
      options: (state.datasource) ? state.datasource.metrics : [],
    }),
  },

  stacked_style: {
    type: 'SelectControl',
    label: t('Stacked Style'),
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
    choices: [
      ['fire', 'fire'],
      ['blue_white_yellow', 'blue/white/yellow'],
      ['white_black', 'white/black'],
      ['black_white', 'black/white'],
      ['dark_blue', 'light/dark blue'],
    ],
    default: 'blue_white_yellow',
    clearable: false,
    description: '',
    renderTrigger: true,
    schemes: spectrums,
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
    label: t('Horizon Color Scale'),
    choices: [
      ['series', 'series'],
      ['overall', 'overall'],
      ['change', 'change'],
    ],
    default: 'series',
    description: t('Defines how the color are attributed.'),
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
    choices: formatSelectOptionsForRange(1, 50),
    default: '1',
    description: t('Number of steps to take between ticks when ' +
    'displaying the X scale'),
  },

  yscale_interval: {
    type: 'SelectControl',
    label: t('YScale Interval'),
    choices: formatSelectOptionsForRange(1, 50),
    default: null,
    description: t('Number of steps to take between ticks when ' +
    'displaying the Y scale'),
  },

  include_time: {
    type: 'CheckboxControl',
    label: t('Include Time'),
    description: t('Whether to include the time granularity as defined in the time section'),
    default: false,
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
    description: t('Reduces the number of X axis ticks to be rendered. ' +
    'If true, the x axis wont overflow and labels may be ' +
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
    type: 'SelectControl',
    label: t('Color Metric'),
    default: null,
    description: t('A metric to use for color'),
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.metrics_combo : [],
    }),
  },
  select_country: {
    type: 'SelectControl',
    label: t('Country Name'),
    default: 'France',
    choices: [
      'Belgium',
      'Brazil',
      'China',
      'Egypt',
      'France',
      'Germany',
      'Italy',
      'Morocco',
      'Netherlands',
      'Russia',
      'Singapore',
      'Spain',
      'Uk',
      'Ukraine',
      'Usa',
    ].map(s => [s, s]),
    description: t('The name of country that Superset should display'),
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

  groupby: groupByControl,

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
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
  },

  all_columns_x: {
    type: 'SelectControl',
    label: 'X',
    default: null,
    description: t('Columns to display'),
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
  },

  all_columns_y: {
    type: 'SelectControl',
    label: 'Y',
    default: null,
    description: t('Columns to display'),
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.all_cols : [],
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
    freeForm: true,
    label: t('Bottom Margin'),
    choices: formatSelectOptions(['auto', 50, 75, 100, 125, 150, 200]),
    default: 'auto',
    renderTrigger: true,
    description: t('Bottom margin, in pixels, allowing for more room for axis labels'),
  },

  left_margin: {
    type: 'SelectControl',
    freeForm: true,
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
    freeForm: true,
    label: t('Link Length'),
    default: '200',
    choices: formatSelectOptions(['10', '25', '50', '75', '100', '150', '200', '250']),
    description: t('Link length in the force layout'),
  },

  charge: {
    type: 'SelectControl',
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
    default: (c) => {
      if (c.options && c.options.length > 0) {
        return c.options[0].column_name;
      }
      return null;
    },
    clearable: false,
    optionRenderer: c => <ColumnOption column={c} />,
    valueRenderer: c => <ColumnOption column={c} />,
    valueKey: 'column_name',
    mapStateToProps: (state) => {
      const newState = {};
      if (state.datasource) {
        newState.options = state.datasource.columns.filter(c => c.is_dttm);
      }
      return newState;
    },
  },

  time_grain_sqla: {
    type: 'SelectControl',
    label: t('Time Grain'),
    default: control => control.choices && control.choices.length ? control.choices[0][0] : null,
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
    label: t('Resample Rule'),
    default: null,
    choices: formatSelectOptions(['', '1T', '1H', '1D', '7D', '1M', '1AS']),
    description: t('Pandas resample rule'),
  },

  resample_how: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Resample How'),
    default: null,
    choices: formatSelectOptions(['', 'mean', 'sum', 'median']),
    description: t('Pandas resample how'),
  },

  resample_fillmethod: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Resample Fill Method'),
    default: null,
    choices: formatSelectOptions(['', 'ffill', 'bfill']),
    description: t('Pandas resample fill method'),
  },

  since: {
    type: 'DateFilterControl',
    freeForm: true,
    label: t('Since'),
    default: t('7 days ago'),
  },

  until: {
    type: 'DateFilterControl',
    freeForm: true,
    label: t('Until'),
    default: 'now',
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
    isFloat: true,
    default: 0.5 * (1 + Math.sqrt(5)),  // d3 default, golden ratio
    description: t('Target aspect ratio for treemap tiles.'),
  },

  number_format: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Number format'),
    renderTrigger: true,
    default: '.3s',
    choices: D3_FORMAT_OPTIONS,
    description: D3_FORMAT_DOCS,
  },

  row_limit: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Row limit'),
    default: null,
    choices: formatSelectOptions(ROW_LIMIT_OPTIONS),
  },

  limit: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Series limit'),
    choices: formatSelectOptions(SERIES_LIMITS),
    default: 50,
    description: t('Limits the number of time series that get displayed'),
  },

  timeseries_limit_metric: {
    type: 'SelectControl',
    label: t('Sort By'),
    default: null,
    description: t('Metric used to define the top series'),
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.metrics_combo : [],
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

  rolling_periods: {
    type: 'TextControl',
    label: t('Periods'),
    isInt: true,
    description: t('Defines the size of the rolling window function, ' +
    'relative to the time granularity selected'),
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
    type: 'SelectControl',
    label: t('Series'),
    default: null,
    description: t('Defines the grouping of entities. ' +
    'Each series is shown as a specific color on the chart and ' +
    'has a legend toggle'),
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.gb_cols : [],
    }),
  },

  entity: {
    type: 'SelectControl',
    label: t('Entity'),
    default: null,
    validators: [v.nonEmpty],
    description: t('This defines the element to be plotted on the chart'),
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.gb_cols : [],
    }),
  },

  x: {
    type: 'SelectControl',
    label: t('X Axis'),
    description: t('Metric assigned to the [X] axis'),
    default: null,
    validators: [v.nonEmpty],
    optionRenderer: m => <MetricOption metric={m} />,
    valueRenderer: m => <MetricOption metric={m} />,
    valueKey: 'metric_name',
    mapStateToProps: state => ({
      options: (state.datasource) ? state.datasource.metrics : [],
    }),
  },

  y: {
    type: 'SelectControl',
    label: t('Y Axis'),
    default: null,
    validators: [v.nonEmpty],
    description: t('Metric assigned to the [Y] axis'),
    optionRenderer: m => <MetricOption metric={m} />,
    valueRenderer: m => <MetricOption metric={m} />,
    valueKey: 'metric_name',
    mapStateToProps: state => ({
      options: (state.datasource) ? state.datasource.metrics : [],
    }),
  },

  size: {
    type: 'SelectControl',
    label: t('Bubble Size'),
    default: null,
    validators: [v.nonEmpty],
    optionRenderer: m => <MetricOption metric={m} />,
    valueRenderer: m => <MetricOption metric={m} />,
    valueKey: 'metric_name',
    mapStateToProps: state => ({
      options: (state.datasource) ? state.datasource.metrics : [],
    }),
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

  where: {
    type: 'TextControl',
    label: t('Custom WHERE clause'),
    default: '',
    description: t('The text in this box gets included in your query\'s WHERE ' +
    'clause, as an AND to other criteria. You can include ' +
    'complex expression, parenthesis and anything else ' +
    'supported by the backend it is directed towards.'),
  },

  having: {
    type: 'TextControl',
    label: t('Custom HAVING clause'),
    default: '',
    description: t('The text in this box gets included in your query\'s HAVING ' +
    'clause, as an AND to other criteria. You can include ' +
    'complex expression, parenthesis and anything else ' +
    'supported by the backend it is directed towards.'),
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
    validators: [v.nonEmpty],
    clearable: false,
    choices: D3_TIME_FORMAT_OPTIONS,
    description: t('Timestamp Format'),
  },

  series_height: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Series Height'),
    default: '25',
    choices: formatSelectOptions(['10', '25', '40', '50', '75', '100', '150', '200']),
    description: t('Pixel height of each series'),
  },

  page_length: {
    type: 'SelectControl',
    freeForm: true,
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
    default: '.3s',
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
    default: '.3s',
    choices: D3_FORMAT_OPTIONS,
    description: D3_FORMAT_DOCS,
  },

  y_axis_2_format: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Right Axis Format'),
    default: '.3s',
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
    label: t('Rotation'),
    choices: formatSelectOptions(['random', 'flat', 'square']),
    default: 'random',
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
      'median',
      'stdev',
      'var',
    ]),
    default: 'sum',
    description: t('Aggregate function to apply when pivoting and ' +
    'computing the total rows and columns'),
  },

  size_from: {
    type: 'TextControl',
    isInt: true,
    label: t('Font Size From'),
    default: '20',
    description: t('Font size for the smallest value in the list'),
  },

  size_to: {
    type: 'TextControl',
    isInt: true,
    label: t('Font Size To'),
    default: '150',
    description: t('Font size for the biggest value in the list'),
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

  show_brush: {
    type: 'CheckboxControl',
    label: t('Range Filter'),
    renderTrigger: true,
    default: false,
    description: t('Whether to display the time range interactive selector'),
  },

  date_filter: {
    type: 'CheckboxControl',
    label: t('Date Filter'),
    default: false,
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
    description: t('Whether to display the interactive data table'),
  },

  include_search: {
    type: 'CheckboxControl',
    label: t('Search Box'),
    renderTrigger: true,
    default: false,
    description: t('Whether to include a client side search box'),
  },

  table_filter: {
    type: 'CheckboxControl',
    label: t('Table Filter'),
    default: false,
    description: t('Whether to apply filter when table cell is clicked'),
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
    default: true,
    description: t('Whether to display the min and max values of the X axis'),
  },

  y_axis_showminmax: {
    type: 'CheckboxControl',
    label: t('Y bounds'),
    renderTrigger: true,
    default: true,
    description: t('Whether to display the min and max values of the Y axis'),
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
    description: t('Use a log scale for the Y axis'),
  },

  x_log_scale: {
    type: 'CheckboxControl',
    label: t('X Log Scale'),
    default: false,
    renderTrigger: true,
    description: t('Use a log scale for the X axis'),
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

  num_period_compare: {
    type: 'TextControl',
    label: t('Period Ratio'),
    default: '',
    isInt: true,
    description: t('[integer] Number of period to compare against, ' +
    'this is relative to the granularity selected'),
  },

  period_ratio_type: {
    type: 'SelectControl',
    label: t('Period Ratio Type'),
    default: 'growth',
    choices: formatSelectOptions(['factor', 'growth', 'value']),
    description: t('`factor` means (new/previous), `growth` is ' +
    '((new/previous) - 1), `value` is (new-previous)'),
  },

  time_compare: {
    type: 'TextControl',
    label: t('Time Shift'),
    default: null,
    description: t('Overlay a timeseries from a ' +
    'relative time period. Expects relative time delta ' +
    'in natural language (example:  24 hours, 7 days, ' +
    '56 weeks, 365 days)'),
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
      choices: (state.datasource) ? state.datasource.all_cols : [],
    }),
  },

  mapbox_style: {
    type: 'SelectControl',
    label: t('Map Style'),
    choices: [
      ['mapbox://styles/mapbox/streets-v9', 'Streets'],
      ['mapbox://styles/mapbox/dark-v9', 'Dark'],
      ['mapbox://styles/mapbox/light-v9', 'Light'],
      ['mapbox://styles/mapbox/satellite-streets-v9', 'Satellite Streets'],
      ['mapbox://styles/mapbox/satellite-v9', 'Satellite'],
      ['mapbox://styles/mapbox/outdoors-v9', 'Outdoors'],
    ],
    default: 'mapbox://styles/mapbox/streets-v9',
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

  point_radius: {
    type: 'SelectControl',
    label: t('Point Radius'),
    default: 'Auto',
    description: t('The radius of individual points (ones that are not in a cluster). ' +
    'Either a numerical column or `Auto`, which scales the point based ' +
    'on the largest cluster'),
    mapStateToProps: state => ({
      choices: [].concat([['Auto', 'Auto']], state.datasource.all_cols),
    }),
  },

  point_radius_unit: {
    type: 'SelectControl',
    label: t('Point Radius Unit'),
    default: 'Pixels',
    choices: formatSelectOptions(['Pixels', 'Miles', 'Kilometers']),
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

  viewport_zoom: {
    type: 'TextControl',
    label: t('Zoom'),
    isFloat: true,
    default: 11,
    description: t('Zoom level of the map'),
    places: 8,
  },

  viewport_latitude: {
    type: 'TextControl',
    label: t('Default latitude'),
    default: 37.772123,
    isFloat: true,
    description: t('Latitude of default viewport'),
    places: 8,
  },

  viewport_longitude: {
    type: 'TextControl',
    label: t('Default longitude'),
    default: -122.405293,
    isFloat: true,
    description: t('Longitude of default viewport'),
    places: 8,
  },

  render_while_dragging: {
    type: 'CheckboxControl',
    label: t('Live render'),
    default: true,
    description: t('Points and clusters will update as viewport is being changed'),
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

  filters: {
    type: 'FilterControl',
    label: '',
    default: [],
    description: '',
    mapStateToProps: state => ({
      datasource: state.datasource,
    }),
  },

  having_filters: {
    type: 'FilterControl',
    label: '',
    default: [],
    description: '',
    mapStateToProps: state => ({
      choices: (state.datasource) ? state.datasource.metrics_combo
        .concat(state.datasource.filterable_cols) : [],
      datasource: state.datasource,
    }),
  },

  slice_id: {
    type: 'HiddenControl',
    label: t('Slice ID'),
    hidden: true,
    description: t('The id of the active slice'),
  },

  cache_timeout: {
    type: 'HiddenControl',
    label: t('Cache Timeout (seconds)'),
    hidden: true,
    description: t('The number of seconds before expiring the cache'),
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
    choices: Object.keys(ALL_COLOR_SCHEMES).map(s => ([s, s])),
    description: t('The color scheme for rendering chart'),
    schemes: ALL_COLOR_SCHEMES,
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

  partition_threshold: {
    type: 'TextControl',
    label: t('Partition Threshold'),
    isFloat: true,
    default: '0.05',
    description:
      t('Partitions whose height to parent height proportions are ' +
      'below this value are pruned'),
  },
};
export default controls;

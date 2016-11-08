import { formatSelectOptionsForRange, formatSelectOptions } from '../../modules/utils';

export const fieldTypes = [
  'CheckboxField',
  'FreeFormSelectField',
  'IntegerField',
  'SelectCustomMultiField',
  'SelectField',
  'SelectMultipleSortableField',
  'TextAreaFeild',
  'TextField',
];

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

const TIME_STAMP_OPTIONS = [
  ['smart_date', 'Adaptative formating'],
  ['%m/%d/%Y', '%m/%d/%Y | 01/14/2019'],
  ['%Y-%m-%d', '%Y-%m-%d | 2019-01-14'],
  ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M:%S | 2019-01-14 01:32:10'],
  ['%H:%M:%S', '%H:%M:%S | 01:32:10'],
];

const SQLA_FILTER_OPTIONS = ['in', 'not in', 'regex'];

const DRUID_FILTER_OPTIONS = SQLA_FILTER_OPTIONS.push('regex');

const DRUID_HAVING_OPTIONS = ['==', '!=', '>', '<', '>=', '<='];

export const FIELD_CHOICES_OPTIONS = {
  D3_TIME_FORMAT_OPTIONS,
  ROW_LIMIT_OPTIONS,
  SERIES_LIMITS,
  TIME_STAMP_OPTIONS,
  SQLA_FILTER_OPTIONS,
  DRUID_FILTER_OPTIONS,
  DRUID_HAVING_OPTIONS,
};

export const commonControlPanelSections = {
  druidTimeSeries: {
    label: 'Time',
    description: 'Time related form attributes',
    fieldSetRows: [
      ['granularity', 'druid_time_origin'],
      ['since', 'until'],
    ],
  },
  datasourceAndVizType: {
    label: 'Datasource & Chart Type',
    fieldSetRows: [
      ['datasource'],
      ['viz_type'],
    ],
  },
  sqlaTimeSeries: {
    label: 'Time',
    description: 'Time related form attributes',
    fieldSetRows: [
      ['granularity_sqla', 'time_grain_sqla'],
      ['since', 'until'],
    ],
  },
  sqlClause: {
    label: 'SQL',
    fieldSetRows: [
      ['where', 'having'],
    ],
    description: 'This section exposes ways to include snippets of SQL in your query',
  },
  NVD3TimeSeries: [
    {
      label: null,
      fieldSetRows: [
        ['metrics'],
        ['groupby'],
        ['limit', 'timeseries_limit_metric'],
      ],
    },
    {
      label: 'Advanced Analytics',
      description: 'This section contains options ' +
                   'that allow for advanced analytical post processing ' +
                    'of query results',
      fieldSetRows: [
          ['rolling_type', 'rolling_periods'],
          ['time_compare'],
          ['num_period_compare', 'period_ratio_type'],
          ['resample_how', 'resample_rule'],
          ['resample_fillmethod'],
      ],
    },
  ],
};

export const visTypes = {
  dist_bar: {
    label: 'Distribution - Bar Chart',
    controlPanelSections: [
      {
        label: 'Chart Options',
        description: 'tooltip text here',
        fieldSetRows: [
          ['columns'],
          ['row_limit'],
          ['show_legend', 'show_bar_value', 'bar_stacked'],
          ['y_axis_format', 'bottom_margin'],
          ['x_axis_label', 'y_axis_label'],
          ['reduce_x_ticks', 'contribution'],
          ['show_controls'],
        ],
      },
    ],
    fieldOverrides: {
      groupby: {
        label: 'Series',
      },
      columns: {
        label: 'Breakdowns',
        description: 'Defines how each series is broken down',
      },
    },
  },

  pie: {
    label: 'Pie Chart',
    controlPanelSections: [
      {
        label: null,
        fields: [
          ['metrics', 'groupby'],
          ['limit'],
          ['pie_label_type'],
          ['donut', 'show_legend'],
          ['labels_outside'],
        ],
      },
    ],
  },

  line: {
    label: 'Time Series - Line Chart',
    requiresTime: true,
    controlPanelSections: [
      commonControlPanelSections.NVD3TimeSeries[0],
      {
        label: 'Chart Options',
        fieldSetRows: [
          ['show_brush', 'show_legend'],
          ['rich_tooltip', 'y_axis_zero'],
          ['y_log_scale', 'contribution'],
          ['show_markers', 'x_axis_showminmax'],
          ['line_interpolation'],
          ['x_axis_format', 'y_axis_format'],
          ['x_axis_label', 'y_axis_label'],
        ],
      },
      commonControlPanelSections.NVD3TimeSeries[1],
    ],
  },

  bar: {
    label: 'Time Series - Bar Chart',
    requiresTime: true,
    controlPanelSections: [
      commonControlPanelSections.NVD3TimeSeries[0],
      {
        label: 'Chart Options',
        fieldSetRows: [
          ['show_brush', 'show_legend', 'show_bar_value'],
          ['rich_tooltip', 'y_axis_zero'],
          ['y_log_scale', 'contribution'],
          ['x_axis_format', 'y_axis_format'],
          ['line_interpolation', 'bar_stacked'],
          ['x_axis_showminmax', 'bottom_margin'],
          ['x_axis_label', 'y_axis_label'],
          ['reduce_x_ticks', 'show_controls'],
        ],
      },
      commonControlPanelSections.NVD3TimeSeries[1],
    ],
  },

  compare: {
    label: 'Time Series - Percent Change',
    requiresTime: true,
    controlPanelSections: [
      commonControlPanelSections.NVD3TimeSeries[0],
      commonControlPanelSections.NVD3TimeSeries[1],
    ],
  },

  area: {
    label: 'Time Series - Stacked',
    requiresTime: true,
    controlPanelSections: [
      commonControlPanelSections.NVD3TimeSeries[0],
      {
        label: 'Chart Options',
        fieldSetRows: [
          ['show_brush', 'show_legend'],
          ['rich_tooltip', 'y_axis_zero'],
          ['y_log_scale', 'contribution'],
          ['x_axis_format', 'y_axis_format'],
          ['x_axis_showminmax', 'show_controls'],
          ['line_interpolation', 'stacked_style'],
        ],
      },
      commonControlPanelSections.NVD3TimeSeries[1],
    ],
  },

  table: {
    label: 'Table View',
    controlPanelSections: [
      {
        label: 'GROUP BY',
        description: 'Use this section if you want a query that aggregates',
        fieldSetRows: [
          ['groupby', 'metrics'],
        ],
      },
      {
        label: 'NOT GROUPED BY',
        description: 'Use this section if you want to query atomic rows',
        fieldSetRows: [
          ['all_columns', 'order_by_cols'],
        ],
      },
      {
        label: 'Options',
        fieldSetRows: [
          ['table_timestamp_format'],
          ['row_limit'],
          ['include_search'],
        ],
      },
    ],
  },

  markup: {
    label: 'Markup',
    controlPanelSections: [
      {
        label: null,
        fieldSetRows: [
          ['markup_type', 'code'],
        ],
      },
    ],
  },

  pivot_table: {
    label: 'Pivot Table',
    controlPanelSections: [
      {
        label: null,
        fieldSetRows: [
          ['groupby', 'columns'],
          ['metrics', 'pandas_aggfunc'],
        ],
      },
    ],
  },

  separator: {
    label: 'Separator',
    controlPanelSections: [
      {
        label: null,
        fieldSetRows: [
          ['code'],
        ],
      },
    ],
    fieldOverrides: {
      code: {
        default: '####Section Title\n' +
                 'A paragraph describing the section' +
                 'of the dashboard, right before the separator line ' +
                 '\n\n' +
                 '---------------',
      },
    },
  },

  word_cloud: {
    label: 'Word Cloud',
    controlPanelSections: [
      {
        label: null,
        fieldSetRows: [
          ['series', 'metric', 'limit'],
          ['size_from', 'size_to'],
          ['rotation'],
        ],
      },
    ],
  },

  treemap: {
    label: 'Treemap',
    controlPanelSections: [
      {
        label: null,
        fieldSetRows: [
          ['metrics'],
          ['groupby'],
        ],
      },
      {
        label: 'Chart Options',
        fieldSetRows: [
          ['treemap_ratio'],
          ['number_format'],
        ],
      },
    ],
  },

  cal_heatmap: {
    label: 'Calendar Heatmap',
    requiresTime: true,
    controlPanelSections: [
      {
        label: null,
        fieldSetRows: [
          ['metric'],
          ['domain_granularity'],
          ['subdomain_granularity'],
        ],
      },
    ],
  },

  box_plot: {
    label: 'Box Plot',
    controlPanelSections: [
      {
        label: null,
        fieldSetRows: [
          ['metrics'],
          ['groupby', 'limit'],
        ],
      },
      {
        label: 'Chart Options',
        fieldSetRows: [
          ['whisker_options'],
        ],
      },
    ],
  },

  bubble: {
    label: 'Bubble Chart',
    controlPanelSections: [
      {
        label: null,
        fieldSetRows: [
          ['series', 'entity'],
          ['x', 'y'],
          ['size', 'limit'],
        ],
      },
      {
        label: 'Chart Options',
        fieldSetRows: [
          ['x_log_scale', 'y_log_scale'],
          ['show_legend'],
          ['max_bubble_size'],
          ['x_axis_label', 'y_axis_label'],
        ],
      },
    ],
  },

  big_number: {
    label: 'Big Number with Trendline',
    controlPanelSections: [
      {
        label: null,
        fieldSetRows: [
          ['metric'],
          ['compare_lag'],
          ['compare_suffix'],
          ['y_axis_format'],
        ],
      },
    ],
    fieldOverrides: {
      y_axis_format: {
        label: 'Number format',
      },
    },
  },

  histogram: {
    label: 'Histogram',
    controlPanelSections: [
      {
        label: null,
        fieldSetRows: [
          ['all_columns_x'],
          ['row_limit'],
        ],
      },
      {
        label: 'Histogram Options',
        fieldSetRows: [
          ['link_length'],
        ],
      },
    ],
    fieldOverrides: {
      all_columns_x: {
        label: 'Numeric Column',
        description: 'Select the numeric column to draw the histogram',
      },
      link_length: {
        label: 'No of Bins',
        description: 'Select number of bins for the histogram',
        default: 5,
      },
    },
  },

  sunburst: {
    label: 'Sunburst',
    controlPanelSections: [
      {
        label: null,
        fieldSetRows: [
          ['groupby'],
          ['metric', 'secondary_metric'],
          ['row_limit'],
        ],
      },
    ],
    fieldOverrides: {
      metric: {
        label: 'Primary Metric',
        description: 'The primary metric is used to define the arc segment sizes',
      },
      secondary_metric: {
        label: 'Secondary Metric',
        description: 'This secondary metric is used to ' +
                     'define the color as a ratio against the primary metric. ' +
                     'If the two metrics match, color is mapped level groups',
      },
      groupby: {
        label: 'Hierarchy',
        description: 'This defines the level of the hierarchy',
      },
    },
  },

  sankey: {
    label: 'Sankey',
    controlPanelSections: [
      {
        label: null,
        fieldSetRows: [
          ['groupby'],
          ['metric'],
          ['row_limit'],
        ],
      },
    ],
    fieldOverrides: {
      groupby: {
        label: 'Source / Target',
        description: 'Choose a source and a target',
      },
    },
  },

  directed_force: {
    label: 'Directed Force Layout',
    controlPanelSections: [
      {
        label: null,
        fieldSetRows: [
          ['groupby'],
          ['metric'],
          ['row_limit'],
        ],
      },
      {
        label: 'Force Layout',
        fieldSetRows: [
          ['link_length'],
          ['charge'],
        ],
      },
    ],
    fieldOverrides: {
      groupby: {
        label: 'Source / Target',
        description: 'Choose a source and a target',
      },
    },
  },

  world_map: {
    label: 'World Map',
    controlPanelSections: [
      {
        label: null,
        fieldSetRows: [
          ['entity'],
          ['country_fieldtype'],
          ['metric'],
        ],
      },
      {
        label: 'Bubbles',
        fieldSetRows: [
          ['show_bubbles'],
          ['secondary_metric'],
          ['max_bubble_size'],
        ],
      },
    ],
    fieldOverrides: {
      entity: {
        label: 'Country Field',
        description: '3 letter code of the country',
      },
      metric: {
        label: 'Metric for color',
        description: 'Metric that defines the color of the country',
      },
      secondary_metric: {
        label: 'Bubble size',
        description: 'Metric that defines the size of the bubble',
      },
    },
  },

  filter_box: {
    label: 'Filter Box',
    controlPanelSections: [
      {
        label: null,
        fieldSetRows: [
          ['date_filter'],
          ['groupby'],
          ['metric'],
        ],
      },
    ],
    fieldOverrides: {
      groupby: {
        label: 'Filter fields',
        description: 'The fields you want to filter on',
        default: [],
      },
    },
  },

  iframe: {
    label: 'iFrame',
    controlPanelSections: [
      {
        label: null,
        fieldSetRows: [
          ['url'],
        ],
      },
    ],
  },

  para: {
    label: 'Parallel Coordinates',
    controlPanelSections: [
      {
        label: null,
        fieldSetRows: [
          ['series'],
          ['metrics'],
          ['secondary_metric'],
          ['limit'],
          ['show_datatable', 'include_series'],
        ],
      },
    ],
  },

  heatmap: {
    label: 'Heatmap',
    controlPanelSections: [
      {
        label: null,
        fieldSetRows: [
          ['all_columns_x'],
          ['all_columns_y'],
          ['metric'],
        ],
      },
      {
        label: 'Heatmap Options',
        fieldSetRows: [
          ['linear_color_scheme'],
          ['xscale_interval', 'yscale_interval'],
          ['canvas_image_rendering'],
          ['normalize_across'],
        ],
      },
    ],
  },

  horizon: {
    label: 'Horizon',
    controlPanelSections: [
      commonControlPanelSections.NVD3TimeSeries[0],
      {
        label: 'Chart Options',
        fieldSetRows: [
          ['series_height', 'horizon_color_scale'],
        ],
      },
    ],
  },

  mapbox: {
    label: 'Mapbox',
    controlPanelSections: [
      {
        label: null,
        fieldSetRows: [
          ['all_columns_x', 'all_columns_y'],
          ['clustering_radius'],
          ['row_limit'],
          ['groupby'],
          ['render_while_dragging'],
        ],
      },
      {
        label: 'Points',
        fieldSetRows: [
          ['point_radius'],
          ['point_radius_unit'],
        ],
      },
      {
        label: 'Labelling',
        fieldSetRows: [
          ['mapbox_label'],
          ['pandas_aggfunc'],
        ],
      },
      {
        label: 'Visual Tweaks',
        fieldSetRows: [
          ['mapbox_style'],
          ['global_opacity'],
          ['mapbox_color'],
        ],
      },
      {
        label: 'Viewport',
        fieldSetRows: [
          ['viewport_longitude'],
          ['viewport_latitude'],
          ['viewport_zoom'],
        ],
      },
    ],
    fieldOverrides: {
      all_columns_x: {
        label: 'Longitude',
        description: 'Column containing longitude data',
      },
      all_columns_y: {
        label: 'Latitude',
        description: 'Column containing latitude data',
      },
      pandas_aggfunc: {
        label: 'Cluster label aggregator',
        description: 'Aggregate function applied to the list of points ' +
                     'in each cluster to produce the cluster label.',
      },
      rich_tooltip: {
        label: 'Tooltip',
        description: 'Show a tooltip when hovering over points and clusters ' +
                     'describing the label',
      },
      groupby: {
        description: 'One or many fields to group by. If grouping, latitude ' +
                     'and longitude columns must be present.',
      },
    },
  },
};

// todo: complete the choices and default keys from forms.py
export const fields = {
  datasource: {
    type: 'SelectField',
    label: 'Datasource',
    default: '',
    choices: [['datasource', 'datasource']],
    description: '',
  },

  viz_type: {
    type: 'SelectField',
    label: 'Viz',
    default: 'table',
    choices: formatSelectOptions(Object.keys(visTypes)),
    description: 'The type of visualization to display',
  },

  metrics: {
    type: 'SelectMultipleSortableField',
    label: 'Metrics',
    choices: [[1, 1]],
    default: ['todo'],
    description: 'One or many metrics to display',
  },

  order_by_cols: {
    type: 'SelectMultipleSortableField',
    label: 'Ordering',
    choices: 'todo: order_by_choices',
    description: 'One or many metrics to display',
  },

  metric: {
    type: 'SelectField',
    label: 'Metric',
    choices: 'todo: ',
    default: 'todo: ',
    description: 'Choose the metric',
  },

  stacked_style: {
    type: 'SelectField',
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
    type: 'SelectField',
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
    type: 'SelectField',
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
    type: 'SelectField',
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
    type: 'SelectField',
    label: 'Rendering',
    choices: [
      ['pixelated', 'pixelated (Sharp)'],
      ['auto', 'auto (Smooth)'],
    ],
    default: 'pixelated',
    description: 'image-rendering CSS attribute of the canvas object that ' +
                 'defines how the browser scales up the image',
  },

  x_scale_interval: {
    type: 'SelectField',
    label: 'XScale Interval',
    choices: formatSelectOptionsForRange(1, 50),
    default: '1',
    description: 'Number of steps to take between ticks when ' +
                 'displaying the X scale',
  },

  y_scale_interval: {
    type: 'SelectField',
    label: 'YScale Interval',
    choices: formatSelectOptionsForRange(1, 50),
    default: '1',
    description: 'Number of steps to take between ticks when ' +
                 'displaying the Y scale',
  },

  bar_stacked: {
    type: 'CheckboxField',
    label: 'Stacked Bars',
    default: false,
    description: '',
  },

  show_markers: {
    type: 'CheckboxField',
    label: 'Show Markers',
    default: false,
    description: 'Show data points as circle markers on the lines',
  },

  show_bar_value: {
    type: 'CheckboxField',
    label: 'Bar Values',
    default: false,
    description: 'Show the value on top of the bar',
  },

  show_controls: {
    type: 'CheckboxField',
    label: 'Extra Controls',
    default: false,
    description: 'Whether to show extra controls or not. Extra controls ' +
                 'include things like making mulitBar charts stacked ' +
                 'or side by side.',
  },

  reduce_x_ticks: {
    type: 'CheckboxField',
    label: 'Reduce X ticks',
    default: false,
    description: 'Reduces the number of X axis ticks to be rendered. ' +
                 'If true, the x axis wont overflow and labels may be ' +
                 'missing. If false, a minimum width will be applied ' +
                 'to columns and the width may overflow into an ' +
                 'horizontal scroll.',
  },

  include_series: {
    type: 'CheckboxField',
    label: 'Include Series',
    default: false,
    description: 'Include series name as an axis',
  },

  secondary_metric: {
    type: 'SelectField',
    label: 'Color Metric',
    choices: [],
    default: '',
    description: 'A metric to use for color',
  },

  country_fieldtype: {
    type: 'SelectField',
    label: 'Country Field Type',
    default: 'cca2',
    choices: [
        ['name', 'Full name'],
        ['cioc', 'code International Olympic Committee (cioc)'],
        ['cca2', 'code ISO 3166-1 alpha-2 (cca2)'],
        ['cca3', 'code ISO 3166-1 alpha-3 (cca3)'],
    ],
    description: 'The country code standard that Caravel should expect ' +
                 'to find in the [country] column',
  },

  groupby: {
    type: 'SelectMultipleSortableField',
    label: 'Group by',
    choices: [],
    description: 'One or many fields to group by',
  },

  columns: {
    type: 'SelectMultipleSortableField',
    label: 'Columns',
    choices: [[1, 1]],
    description: 'One or many fields to pivot as columns',
  },

  all_columns: {
    type: 'SelectMultipleSortableField',
    label: 'Columns',
    choices: [['all_columns', 'all_columns']],
    description: 'Columns to display',
  },

  all_columns_x: {
    type: 'SelectField',
    label: 'X',
    choices: [['all_columns_x', 'all_columns_x']],
    default: '',
    description: 'Columns to display',
  },

  all_columns_y: {
    type: 'SelectField',
    label: 'Y',
    choices: [['all_columns_y', 'all_columns_y']],
    default: '',
    description: 'Columns to display',
  },

  druid_time_origin: {
    type: 'SelectField',
    label: 'Origin',
    choices: [
      ['', 'default'],
      ['now', 'now'],
    ],
    default: '',
    description: 'Defines the origin where time buckets start, ' +
                 'accepts natural dates as in `now`, `sunday` or `1970-01-01`',
  },

  bottom_margin: {
    type: 'SelectField',
    label: 'Bottom Margin',
    choices: formatSelectOptions(['auto', 50, 75, 100, 125, 150, 200]),
    default: 'auto',
    description: 'Bottom marging, in pixels, allowing for more room for axis labels',
  },

  granularity: {
    type: 'SelectField',
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
    ]),
    description: 'The time granularity for the visualization. Note that you ' +
                 'can type and use simple natural language as in `10 seconds`, ' +
                 '`1 day` or `56 weeks`',
  },

  domain_granularity: {
    type: 'SelectField',
    label: 'Domain',
    default: 'month',
    choices: formatSelectOptions(['hour', 'day', 'week', 'month', 'year']),
    description: 'The time unit used for the grouping of blocks',
  },

  subdomain_granularity: {
    type: 'SelectField',
    label: 'Subdomain',
    default: 'day',
    choices: formatSelectOptions(['min', 'hour', 'day', 'week', 'month']),
    description: 'The time unit for each block. Should be a smaller unit than ' +
                 'domain_granularity. Should be larger or equal to Time Grain',
  },

  link_length: {
    type: 'SelectField',
    label: 'Link Length',
    default: '200',
    choices: formatSelectOptions(['10', '25', '50', '75', '100', '150', '200', '250']),
    description: 'Link length in the force layout',
  },

  charge: {
    type: 'FreeFormSelectField',
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
    type: 'SelectField',
    label: 'Time Column',
    default: 'granularity_sqla',
    choices: [['granularity_sqla', 'granularity_sqla']],
    description: 'The time column for the visualization. Note that you ' +
                 'can define arbitrary expression that return a DATETIME ' +
                 'column in the table or. Also note that the ' +
                 'filter below is applied against this column or ' +
                 'expression',
  },

  time_grain: {
    label: 'Time Grain',
    choices: ['grains-choices'],
    default: 'Time Column',
    description: 'The time granularity for the visualization. This ' +
                 'applies a date transformation to alter ' +
                 'your time column and defines a new time granularity. ' +
                 'The options here are defined on a per database ' +
                 'engine basis in the Caravel source code.',
  },

  resample_rule: {
    type: 'FreeFormSelectField',
    label: 'Resample Rule',
    default: '',
    choices: formatSelectOptions(['', '1T', '1H', '1D', '7D', '1M', '1AS']),
    description: 'Pandas resample rule',
  },

  resample_how: {
    type: 'SelectField',
    label: 'Resample How',
    default: '',
    choices: formatSelectOptions(['', 'mean', 'sum', 'median']),
    description: 'Pandas resample how',
  },

  resample_fillmethod: {
    type: 'SelectField',
    label: 'Resample Fill Method',
    default: '',
    choices: formatSelectOptions(['', 'ffill', 'bfill']),
    description: 'Pandas resample fill method',
  },

  since: {
    type: 'SelectField',
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
    ]),
    description: 'Timestamp from filter. This supports free form typing and ' +
                 'natural language as in `1 day ago`, `28 days` or `3 years`',
  },

  until: {
    type: 'SelectField',
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
    type: 'SelectField',
    label: 'Max Bubble Size',
    default: '25',
    choices: formatSelectOptions(['5', '10', '15', '25', '50', '75', '100']),
  },

  whisker_options: {
    type: 'SelectField',
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
    type: 'IntegerField',
    label: 'Ratio',
    default: 0.5 * (1 + Math.sqrt(5)),  // d3 default, golden ratio
    description: 'Target aspect ratio for treemap tiles.',
  },

  number_format: {
    type: 'SelectField',
    label: 'Number format',
    default: '.3s',
    choices: D3_TIME_FORMAT_OPTIONS,
    description: D3_FORMAT_DOCS,
  },

  row_limit: {
    type: 'SelectField',
    label: 'Row limit',
    default: '',
    choices: formatSelectOptions(ROW_LIMIT_OPTIONS),
  },

  limit: {
    type: 'SelectField',
    label: 'Series limit',
    choices: formatSelectOptions(SERIES_LIMITS),
    default: 50,
    description: 'Limits the number of time series that get displayed',
  },

  timeseries_limit_metric: {
    type: 'SelectField',
    label: 'Sort By',
    choices: [['', ''], ['timeseries_limit_metric', 'timeseries_limit_metric']],
    default: '',
    description: 'Metric used to define the top series',
  },

  rolling_type: {
    type: 'SelectField',
    label: 'Rolling',
    default: 'None',
    choices: formatSelectOptions(['None', 'mean', 'sum', 'std', 'cumsum']),
    description: 'Defines a rolling window function to apply, works along ' +
                 'with the [Periods] text box',
  },

  rolling_periods: {
    type: 'IntegerField',
    label: 'Periods',
    validators: ['todo: [validators.optional()]'],
    description: 'Defines the size of the rolling window function, ' +
                 'relative to the time granularity selected',
  },

  series: {
    type: 'SelectField',
    label: 'Series',
    choices: formatSelectOptions(['', 'series']),
    default: '',
    description: 'Defines the grouping of entities. ' +
                 'Each series is shown as a specific color on the chart and ' +
                 'has a legend toggle',
  },

  entity: {
    type: 'SelectField',
    label: 'Entity',
    choices: formatSelectOptions(['', 'entity']),
    default: '',
    description: 'This define the element to be plotted on the chart',
  },

  x: {
    type: 'SelectField',
    label: 'X Axis',
    choices: formatSelectOptions(['', 'metrics assigned to x']),
    default: '',
    description: 'Metric assigned to the [X] axis',
  },

  y: {
    type: 'SelectField',
    label: 'Y Axis',
    choices: formatSelectOptions(['', 'metrics assigned to x']),
    default: '',
    description: 'Metric assigned to the [Y] axis',
  },

  size: {
    type: 'SelectField',
    label: 'Bubble Size',
    default: '',
    choices: formatSelectOptions(['', 'bubble-size']),
  },

  url: {
    type: 'TextField',
    label: 'URL',
    description: 'The URL, this field is templated, so you can integrate ' +
                 '{{ width }} and/or {{ height }} in your URL string.',
    default: 'https: //www.youtube.com/embed/JkI5rg_VcQ4',
  },

  x_axis_label: {
    type: 'TextField',
    label: 'X Axis Label',
    default: '',
  },

  y_axis_label: {
    type: 'TextField',
    label: 'Y Axis Label',
    default: '',
  },

  where: {
    type: 'TextField',
    label: 'Custom WHERE clause',
    default: '',
    description: 'The text in this box gets included in your query\'s WHERE ' +
                 'clause, as an AND to other criteria. You can include ' +
                 'complex expression, parenthesis and anything else ' +
                 'supported by the backend it is directed towards.',
  },

  having: {
    type: 'TextField',
    label: 'Custom HAVING clause',
    default: '',
    description: 'The text in this box gets included in your query\'s HAVING ' +
                 'clause, as an AND to other criteria. You can include ' +
                 'complex expression, parenthesis and anything else ' +
                 'supported by the backend it is directed towards.',
  },

  compare_lag: {
    type: 'TextField',
    label: 'Comparison Period Lag',
    description: 'Based on granularity, number of time periods to compare against',
  },

  compare_suffix: {
    type: 'TextField',
    label: 'Comparison suffix',
    description: 'Suffix to apply after the percentage display',
  },

  table_timestamp_format: {
    type: 'SelectField',
    label: 'Table Timestamp Format',
    default: 'smart_date',
    choices: formatSelectOptions(TIME_STAMP_OPTIONS),
    description: 'Timestamp Format',
  },

  series_height: {
    type: 'SelectCustomMultiField',
    label: 'Series Height',
    default: 25,
    choices: formatSelectOptions([10, 25, 40, 50, 75, 100, 150, 200]),
    description: 'Pixel height of each series',
  },

  x_axis_format: {
    type: 'SelectCustomMultiField',
    label: 'X axis format',
    default: 'smart_date',
    choices: formatSelectOptions(TIME_STAMP_OPTIONS),
    description: D3_FORMAT_DOCS,
  },

  y_axis_format: {
    type: 'SelectCustomMultiField',
    label: 'Y axis format',
    default: '.3s',
    choices: D3_TIME_FORMAT_OPTIONS,
    description: D3_FORMAT_DOCS,
  },

  markup_type: {
    type: 'SelectField',
    label: 'Markup Type',
    choices: formatSelectOptions(['markdown', 'html']),
    default: 'markdown',
    description: 'Pick your favorite markup language',
  },

  rotation: {
    type: 'SelectField',
    label: 'Rotation',
    choices: formatSelectOptions(['random', 'flat', 'square']),
    default: 'random',
    description: 'Rotation to apply to words in the cloud',
  },

  line_interpolation: {
    type: 'SelectField',
    label: 'Line Style',
    choices: formatSelectOptions(['linear', 'basis', 'cardinal',
      'monotone', 'step-before', 'step-after']),
    default: 'linear',
    description: 'Line interpolation as defined by d3.js',
  },

  pie_label_type: {
    type: 'SelectField',
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
    type: 'TextAreaField',
    label: 'Code',
    description: 'Put your code here',
    default: '',
  },

  pandas_aggfunc: {
    type: 'SelectField',
    label: 'Aggregation function',
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
    type: 'TextField',
    label: 'Font Size From',
    default: '20',
    description: 'Font size for the smallest value in the list',
  },

  size_to: {
    type: 'TextField',
    label: 'Font Size To',
    default: '150',
    description: 'Font size for the biggest value in the list',
  },

  show_brush: {
    type: 'CheckboxField',
    label: 'Range Filter',
    default: false,
    description: 'Whether to display the time range interactive selector',
  },

  date_filter: {
    type: 'CheckboxField',
    label: 'Date Filter',
    default: false,
    description: 'Whether to include a time filter',
  },

  show_datatable: {
    type: 'CheckboxField',
    label: 'Data Table',
    default: false,
    description: 'Whether to display the interactive data table',
  },

  include_search: {
    type: 'CheckboxField',
    label: 'Search Box',
    default: false,
    description: 'Whether to include a client side search box',
  },

  show_bubbles: {
    type: 'CheckboxField',
    label: 'Show Bubbles',
    default: false,
    description: 'Whether to display bubbles on top of countries',
  },

  show_legend: {
    type: 'CheckboxField',
    label: 'Legend',
    default: true,
    description: 'Whether to display the legend (toggles)',
  },

  x_axis_showminmax: {
    type: 'CheckboxField',
    label: 'X bounds',
    default: true,
    description: 'Whether to display the min and max values of the X axis',
  },

  rich_tooltip: {
    type: 'CheckboxField',
    label: 'Rich Tooltip',
    default: true,
    description: 'The rich tooltip shows a list of all series for that ' +
                 'point in time',
  },

  y_axis_zero: {
    type: 'CheckboxField',
    label: 'Y Axis Zero',
    default: false,
    description: 'Force the Y axis to start at 0 instead of the minimum value',
  },

  y_log_scale: {
    type: 'CheckboxField',
    label: 'Y Log Scale',
    default: false,
    description: 'Use a log scale for the Y axis',
  },

  x_log_scale: {
    type: 'CheckboxField',
    label: 'X Log Scale',
    default: false,
    description: 'Use a log scale for the X axis',
  },

  donut: {
    type: 'CheckboxField',
    label: 'Donut',
    default: false,
    description: 'Do you want a donut or a pie?',
  },

  labels_outside: {
    type: 'CheckboxField',
    label: 'Put labels outside',
    default: true,
    description: 'Put the labels outside the pie?',
  },

  contribution: {
    type: 'CheckboxField',
    label: 'Contribution',
    default: false,
    description: 'Compute the contribution to the total',
  },

  num_period_compare: {
    type: 'IntegerField',
    label: 'Period Ratio',
    default: '',
    validators: 'todo: [validators.optional()]',
    description: '[integer] Number of period to compare against, ' +
                 'this is relative to the granularity selected',
  },

  period_ratio_type: {
    type: 'SelectField',
    label: 'Period Ratio Type',
    default: 'growth',
    choices: formatSelectOptions(['factor', 'growth', 'value']),
    description: '`factor` means (new/previous), `growth` is ' +
                 '((new/previous) - 1), `value` is (new-previous)',
  },

  time_compare: {
    type: 'TextField',
    label: 'Time Shift',
    default: '',
    description: 'Overlay a timeseries from a ' +
                 'relative time period. Expects relative time delta ' +
                 'in natural language (example:  24 hours, 7 days, ' +
                 '56 weeks, 365 days',
  },

  subheader: {
    type: 'TextField',
    label: 'Subheader',
    description: 'Description text that shows up below your Big Number',
  },

  mapbox_label: {
    type: 'SelectMultipleSortableField',
    label: 'label',
    choices: "todo: formatSelectOptions(['count'] + datasource.column_names)",
    description: '`count` is COUNT(*) if a group by is used. ' +
                 'Numerical columns will be aggregated with the aggregator. ' +
                 'Non-numerical columns will be used to label points. ' +
                 'Leave empty to get a count of points in each cluster.',
  },

  mapbox_style: {
    type: 'SelectField',
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
    type: 'FreeFormSelectField',
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
    type: 'SelectField',
    label: 'Point Radius',
    default: 'Auto',
    choices: "todo: formatSelectOptions(['Auto'] + datasource.column_names)",
    description: 'The radius of individual points (ones that are not in a cluster). ' +
                 'Either a numerical column or `Auto`, which scales the point based ' +
                 'on the largest cluster',
  },

  point_radius_unit: {
    type: 'SelectField',
    label: 'Point Radius Unit',
    default: 'Pixels',
    choices: formatSelectOptions(['Pixels', 'Miles', 'Kilometers']),
    description: 'The unit of measure for the specified point radius',
  },

  global_opacity: {
    type: 'IntegerField',
    label: 'Opacity',
    default: 1,
    description: 'Opacity of all clusters, points, and labels. ' +
                 'Between 0 and 1.',
  },

  viewport_zoom: {
    type: 'IntegerField',
    label: 'Zoom',
    default: 11,
    validators: 'todo: [validators.optional()]',
    description: 'Zoom level of the map',
    places: 8,
  },

  viewport_latitude: {
    type: 'IntegerField',
    label: 'Default latitude',
    default: 37.772123,
    description: 'Latitude of default viewport',
    places: 8,
  },

  viewport_longitude: {
    type: 'IntegerField',
    label: 'Default longitude',
    default: -122.405293,
    description: 'Longitude of default viewport',
    places: 8,
  },

  render_while_dragging: {
    type: 'CheckboxField',
    label: 'Live render',
    default: true,
    description: 'Points and clusters will update as viewport is being changed',
  },

  mapbox_color: {
    type: 'SelectField',
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
};

const defaultFormData = {};
defaultFormData.slice_name = null;
defaultFormData.slice_id = null;
Object.keys(fields).forEach((k) => { defaultFormData[k] = fields[k].default; });

export const defaultViz = {
  cached_key: null,
  cached_timeout: null,
  cached_dttm: null,
  column_formats: null,
  csv_endpoint: null,
  is_cached: false,
  data: [],
  form_data: defaultFormData,
  json_endpoint: null,
  query: null,
  standalone_endpoint: null,
};

export const initialState = {
  datasources: null,
  datasource_id: null,
  datasource_type: null,
  timeColumnOpts: [],
  timeGrainOpts: [],
  groupByColumnOpts: [],
  metricsOpts: [],
  columnOpts: [],
  orderingOpts: [],
  filterColumnOpts: [],
  viz: defaultViz,
};

export const defaultOpts = {
  timeColumnOpts: [],
  timeGrainOpts: [],
  groupByColumnOpts: [],
  metricsOpts: [],
  filterColumnOpts: [],
  columnOpts: [],
  orderingOpts: [],
};

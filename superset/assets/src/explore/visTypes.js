/**
 * This file defines how controls (defined in controls.js) are structured into sections
 * and associated with each and every visualization type.
 */
import { D3_TIME_FORMAT_OPTIONS } from './controls';
import * as v from './validators';
import { t } from '../locales';

export const sections = {
  druidTimeSeries: {
    label: t('Time'),
    expanded: true,
    description: t('Time related form attributes'),
    controlSetRows: [
      ['granularity', 'druid_time_origin'],
      ['since', 'until'],
    ],
  },
  datasourceAndVizType: {
    label: t('Datasource & Chart Type'),
    expanded: true,
    controlSetRows: [
      ['datasource'],
      ['viz_type'],
      ['slice_id', 'cache_timeout'],
    ],
  },
  colorScheme: {
    label: t('Color Scheme'),
    controlSetRows: [
      ['color_scheme'],
    ],
  },
  sqlaTimeSeries: {
    label: t('Time'),
    description: t('Time related form attributes'),
    expanded: true,
    controlSetRows: [
      ['granularity_sqla', 'time_grain_sqla'],
      ['since', 'until'],
    ],
  },
  sqlClause: {
    label: t('SQL'),
    controlSetRows: [
      ['where'],
      ['having'],
    ],
    description: t('This section exposes ways to include snippets of SQL in your query'),
  },
  annotations: {
    label: t('Annotations and Layers'),
    expanded: true,
    controlSetRows: [
      ['annotation_layers'],
    ],
  },
  NVD3TimeSeries: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['metrics'],
        ['adhoc_filters'],
        ['groupby'],
        ['limit', 'timeseries_limit_metric'],
        ['order_desc', 'contribution'],
      ],
    },
    {
      label: t('Advanced Analytics'),
      description: t('This section contains options ' +
      'that allow for advanced analytical post processing ' +
      'of query results'),
      controlSetRows: [
        ['rolling_type', 'rolling_periods', 'min_periods'],
        ['time_compare', null],
        ['num_period_compare', 'period_ratio_type'],
        ['resample_how', 'resample_rule', 'resample_fillmethod'],
      ],
    },
  ],
  filters: [
    {
      label: t('Filters'),
      expanded: true,
      controlSetRows: [['filters']],
    },
    {
      label: t('Result Filters'),
      expanded: true,
      description: t('The filters to apply after post-aggregation.' +
      'Leave the value control empty to filter empty strings or nulls'),
      controlSetRows: [['having_filters']],
    },
  ],
};

const timeGrainSqlaAnimationOverrides = {
  default: null,
  mapStateToProps: state => ({
    choices: (state.datasource) ?
      state.datasource.time_grain_sqla.filter(o => o[0] !== null) :
      null,
  }),
};

export const visTypes = {
  dist_bar: {
    label: t('Distribution - Bar Chart'),
    showOnExplore: true,
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['metrics'],
          ['adhoc_filters'],
          ['groupby'],
          ['columns'],
          ['row_limit'],
          ['contribution'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
          ['show_legend', 'show_bar_value'],
          ['bar_stacked', 'order_bars'],
          ['y_axis_format', 'y_axis_label'],
          ['show_controls', null],
        ],
      },
      {
        label: t('X Axis'),
        expanded: true,
        controlSetRows: [
          ['x_axis_label', 'bottom_margin'],
          ['x_ticks_layout', 'reduce_x_ticks'],
        ],
      },
    ],
    controlOverrides: {
      groupby: {
        label: t('Series'),
      },
      columns: {
        label: t('Breakdowns'),
        description: t('Defines how each series is broken down'),
      },
    },
  },

  pie: {
    label: t('Pie Chart'),
    showOnExplore: true,
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['metrics'],
          ['adhoc_filters'],
          ['groupby'],
          ['limit'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['pie_label_type'],
          ['donut', 'show_legend'],
          ['labels_outside'],
          ['color_scheme'],
        ],
      },
    ],
  },

  line: {
    label: t('Time Series - Line Chart'),
    showOnExplore: true,
    requiresTime: true,
    controlPanelSections: [
      sections.NVD3TimeSeries[0],
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
          ['show_brush', 'show_legend'],
          ['rich_tooltip', 'show_markers'],
          ['line_interpolation'],
        ],
      },
      {
        label: t('X Axis'),
        expanded: true,
        controlSetRows: [
          ['x_axis_label', 'bottom_margin'],
          ['x_ticks_layout', 'x_axis_format'],
          ['x_axis_showminmax', null],
        ],
      },
      {
        label: t('Y Axis'),
        expanded: true,
        controlSetRows: [
          ['y_axis_label', 'left_margin'],
          ['y_axis_showminmax', 'y_log_scale'],
          ['y_axis_format', 'y_axis_bounds'],
        ],
      },
      sections.NVD3TimeSeries[1],
      sections.annotations,
    ],
    controlOverrides: {
      x_axis_format: {
        choices: D3_TIME_FORMAT_OPTIONS,
        default: 'smart_date',
      },
    },
  },

  time_pivot: {
    label: t('Time Series - Periodicity Pivot'),
    showOnExplore: true,
    requiresTime: true,
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['metric', 'freq'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['show_legend', 'line_interpolation'],
          ['color_picker', null],
        ],
      },
      {
        label: t('X Axis'),
        expanded: true,
        controlSetRows: [
          ['x_axis_label', 'bottom_margin'],
          ['x_axis_showminmax', 'x_axis_format'],
        ],
      },
      {
        label: t('Y Axis'),
        expanded: true,
        controlSetRows: [
          ['y_axis_label', 'left_margin'],
          ['y_axis_showminmax', 'y_log_scale'],
          ['y_axis_format', 'y_axis_bounds'],
        ],
      },
    ],
    controlOverrides: {
      x_axis_format: {
        choices: D3_TIME_FORMAT_OPTIONS,
        default: 'smart_date',
      },
    },
  },

  dual_line: {
    label: t('Dual Axis Line Chart'),
    requiresTime: true,
    controlPanelSections: [
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
          ['x_axis_format'],
        ],
      },
      {
        label: t('Y Axis 1'),
        expanded: true,
        controlSetRows: [
          ['metric', 'y_axis_format'],
        ],
      },
      {
        label: t('Y Axis 2'),
        expanded: true,
        controlSetRows: [
          ['metric_2', 'y_axis_2_format'],
        ],
      },
      sections.annotations,
    ],
    controlOverrides: {
      metric: {
        label: t('Left Axis Metric'),
        description: t('Choose a metric for left axis'),
      },
      y_axis_format: {
        label: t('Left Axis Format'),
      },
      x_axis_format: {
        choices: D3_TIME_FORMAT_OPTIONS,
        default: 'smart_date',
      },
    },
  },

  bar: {
    label: t('Time Series - Bar Chart'),
    showOnExplore: true,
    requiresTime: true,
    controlPanelSections: [
      sections.NVD3TimeSeries[0],
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
          ['show_brush', 'show_legend', 'show_bar_value'],
          ['rich_tooltip', 'bar_stacked'],
          ['line_interpolation', 'show_controls'],
          ['bottom_margin'],
        ],
      },
      {
        label: t('X Axis'),
        expanded: true,
        controlSetRows: [
          ['x_axis_label', 'bottom_margin'],
          ['x_ticks_layout', 'x_axis_format'],
          ['x_axis_showminmax', 'reduce_x_ticks'],
        ],
      },
      {
        label: t('Y Axis'),
        expanded: true,
        controlSetRows: [
          ['y_axis_label', 'left_margin'],
          ['y_axis_showminmax', 'y_log_scale'],
          ['y_axis_format', 'y_axis_bounds'],
        ],
      },
      sections.NVD3TimeSeries[1],
      sections.annotations,
    ],
    controlOverrides: {
      x_axis_format: {
        choices: D3_TIME_FORMAT_OPTIONS,
        default: 'smart_date',
      },
    },
  },

  compare: {
    label: t('Time Series - Percent Change'),
    requiresTime: true,
    controlPanelSections: [
      sections.NVD3TimeSeries[0],
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
        ],
      },
      {
        label: t('X Axis'),
        expanded: true,
        controlSetRows: [
          ['x_axis_label', 'bottom_margin'],
          ['x_ticks_layout', 'x_axis_format'],
          ['x_axis_showminmax', null],
        ],
      },
      {
        label: t('Y Axis'),
        expanded: true,
        controlSetRows: [
          ['y_axis_label', 'left_margin'],
          ['y_axis_showminmax', 'y_log_scale'],
          ['y_axis_format', 'y_axis_bounds'],
        ],
      },
      sections.NVD3TimeSeries[1],
      sections.annotations,
    ],
    controlOverrides: {
      x_axis_format: {
        choices: D3_TIME_FORMAT_OPTIONS,
        default: 'smart_date',
      },
    },
  },

  deck_multi: {
    label: t('Deck.gl - Multiple Layers'),
    requiresTime: true,
    controlPanelSections: [
      {
        label: t('Map'),
        expanded: true,
        controlSetRows: [
          ['mapbox_style', 'viewport'],
          ['deck_slices', null],
        ],
      },
    ],
  },

  deck_hex: {
    label: t('Deck.gl - Hexagons'),
    requiresTime: true,
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['spatial', 'size'],
          ['row_limit', null],
        ],
      },
      {
        label: t('Map'),
        controlSetRows: [
          ['mapbox_style', 'viewport'],
          ['color_picker', 'autozoom'],
          ['grid_size', 'extruded'],
        ],
      },
      {
        label: t('Advanced'),
        controlSetRows: [
          ['js_columns'],
          ['js_data_mutator'],
          ['js_tooltip'],
          ['js_onclick_href'],
        ],
      },
    ],
    controlOverrides: {
      size: {
        label: t('Height'),
        description: t('Metric used to control height'),
      },
    },
  },

  deck_grid: {
    label: t('Deck.gl - Grid'),
    requiresTime: true,
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['spatial', 'size'],
          ['row_limit', null],
        ],
      },
      {
        label: t('Map'),
        controlSetRows: [
          ['mapbox_style', 'viewport'],
          ['color_picker', 'autozoom'],
          ['grid_size', 'extruded'],
        ],
      },
      {
        label: t('Advanced'),
        controlSetRows: [
          ['js_columns'],
          ['js_data_mutator'],
          ['js_tooltip'],
          ['js_onclick_href'],
        ],
      },
    ],
    controlOverrides: {
      size: {
        label: t('Height'),
        description: t('Metric used to control height'),
        validators: [v.nonEmpty],
      },
    },
  },

  deck_path: {
    label: t('Deck.gl - Paths'),
    requiresTime: true,
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['line_column', 'line_type'],
          ['row_limit', null],
        ],
      },
      {
        label: t('Map'),
        expanded: true,
        controlSetRows: [
          ['mapbox_style', 'viewport'],
          ['color_picker', 'line_width'],
          ['reverse_long_lat', 'autozoom'],
        ],
      },
      {
        label: t('Advanced'),
        controlSetRows: [
          ['js_columns'],
          ['js_data_mutator'],
          ['js_tooltip'],
          ['js_onclick_href'],
        ],
      },
    ],
  },

  deck_screengrid: {
    label: t('Deck.gl - Screen grid'),
    requiresTime: true,
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['spatial', 'size'],
          ['row_limit', null],
        ],
      },
      {
        label: t('Map'),
        controlSetRows: [
          ['mapbox_style', 'viewport'],
          ['autozoom', null],
        ],
      },
      {
        label: t('Grid'),
        controlSetRows: [
          ['grid_size', 'color_picker'],
        ],
      },
      {
        label: t('Advanced'),
        controlSetRows: [
          ['js_columns'],
          ['js_data_mutator'],
          ['js_tooltip'],
          ['js_onclick_href'],
        ],
      },
    ],
    controlOverrides: {
      size: {
        label: t('Weight'),
        description: t("Metric used as a weight for the grid's coloring"),
        validators: [v.nonEmpty],
      },
      time_grain_sqla: timeGrainSqlaAnimationOverrides,
    },
  },

  deck_geojson: {
    label: t('Deck.gl - GeoJson'),
    requiresTime: true,
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['geojson', 'row_limit'],
        ],
      },
      {
        label: t('Map'),
        controlSetRows: [
          ['mapbox_style', 'viewport'],
          // TODO ['autozoom', null],
        ],
      },
      {
        label: t('GeoJson Settings'),
        controlSetRows: [
          ['fill_color_picker', 'stroke_color_picker'],
          ['filled', 'stroked'],
          ['extruded', null],
          ['point_radius_scale', null],
        ],
      },
      {
        label: t('Advanced'),
        controlSetRows: [
          ['js_columns'],
          ['js_data_mutator'],
          ['js_tooltip'],
          ['js_onclick_href'],
        ],
      },
    ],
  },

  deck_polygon: {
    label: t('Deck.gl - Polygon'),
    requiresTime: true,
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['line_column', 'line_type'],
          ['row_limit', null],
        ],
      },
      {
        label: t('Map'),
        controlSetRows: [
          ['mapbox_style', 'viewport'],
          ['reverse_long_lat', null],
        ],
      },
      {
        label: t('Polygon Settings'),
        controlSetRows: [
          ['fill_color_picker', 'stroke_color_picker'],
          ['filled', 'stroked'],
          ['extruded', null],
          ['point_radius_scale', null],
        ],
      },
      {
        label: t('Advanced'),
        controlSetRows: [
          ['js_columns'],
          ['js_data_mutator'],
          ['js_tooltip'],
          ['js_onclick_href'],
        ],
      },
    ],
  },

  deck_arc: {
    label: t('Deck.gl - Arc'),
    requiresTime: true,
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['start_spatial', 'end_spatial'],
          ['row_limit', null],
        ],
      },
      {
        label: t('Map'),
        controlSetRows: [
          ['mapbox_style', 'viewport'],
          ['autozoom', null],
        ],
      },
      {
        label: t('Arc'),
        controlSetRows: [
          ['color_picker', null],
          ['stroke_width', null],
        ],
      },
      {
        label: t('Advanced'),
        controlSetRows: [
          ['js_columns'],
          ['js_data_mutator'],
          ['js_tooltip'],
          ['js_onclick_href'],
        ],
      },
    ],
  },

  deck_scatter: {
    label: t('Deck.gl - Scatter plot'),
    requiresTime: true,
    onInit: controlState => ({
      ...controlState,
      time_grain_sqla: {
        ...controlState.time_grain_sqla,
        value: null,
      },
      granularity: {
        ...controlState.granularity,
        value: null,
      },
    }),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['spatial', 'row_limit'],
        ],
      },
      {
        label: t('Map'),
        expanded: true,
        controlSetRows: [
          ['mapbox_style', 'viewport'],
          ['autozoom', null],
        ],
      },
      {
        label: t('Point Size'),
        controlSetRows: [
          ['point_radius_fixed', 'point_unit'],
          ['min_radius', 'max_radius'],
          ['multiplier', null],
        ],
      },
      {
        label: t('Point Color'),
        controlSetRows: [
          ['color_picker', 'legend_position'],
          ['dimension', 'color_scheme'],
        ],
      },
      {
        label: t('Advanced'),
        controlSetRows: [
          ['js_columns'],
          ['js_data_mutator'],
          ['js_tooltip'],
          ['js_onclick_href'],
        ],
      },
    ],
    controlOverrides: {
      dimension: {
        label: t('Categorical Color'),
        description: t('Pick a dimension from which categorical colors are defined'),
      },
      size: {
        validators: [],
      },
      time_grain_sqla: timeGrainSqlaAnimationOverrides,
    },
  },

  area: {
    label: t('Time Series - Stacked'),
    requiresTime: true,
    controlPanelSections: [
      sections.NVD3TimeSeries[0],
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['show_brush', 'show_legend'],
          ['line_interpolation', 'stacked_style'],
          ['color_scheme'],
          ['rich_tooltip', 'show_controls'],
        ],
      },
      {
        label: t('X Axis'),
        expanded: true,
        controlSetRows: [
          ['x_axis_label', 'bottom_margin'],
          ['x_ticks_layout', 'x_axis_format'],
          ['x_axis_showminmax', null],
        ],
      },
      {
        label: t('Y Axis'),
        expanded: true,
        controlSetRows: [
          ['y_axis_format', 'y_axis_bounds'],
          ['y_log_scale', null],
        ],
      },
      sections.NVD3TimeSeries[1],
      sections.annotations,
    ],
    controlOverrides: {
      x_axis_format: {
        default: 'smart_date',
        choices: D3_TIME_FORMAT_OPTIONS,
      },
      color_scheme: {
        renderTrigger: false,
      },
    },
  },

  table: {
    label: t('Table View'),
    controlPanelSections: [
      {
        label: t('GROUP BY'),
        description: t('Use this section if you want a query that aggregates'),
        expanded: true,
        controlSetRows: [
          ['groupby'],
          ['metrics'],
          ['percent_metrics'],
          ['timeseries_limit_metric', 'row_limit'],
          ['include_time', 'order_desc'],
        ],
      },
      {
        label: t('NOT GROUPED BY'),
        description: t('Use this section if you want to query atomic rows'),
        controlSetRows: [
          ['all_columns'],
          ['order_by_cols'],
          ['row_limit', null],
        ],
      },
      {
        label: t('Options'),
        expanded: true,
        controlSetRows: [
          ['table_timestamp_format'],
          ['page_length', null],
          ['include_search', 'table_filter'],
          ['align_pn', 'color_pn'],
        ],
      },
    ],
    controlOverrides: {
      metrics: {
        validators: [],
      },
      time_grain_sqla: {
        default: null,
      },
    },
  },

  time_table: {
    label: t('Time Series Table'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['groupby', 'metrics'],
          ['limit'],
          ['column_collection'],
          ['url'],
        ],
      },
    ],
    controlOverrides: {
      groupby: {
        multiple: false,
      },
      url: {
        description: t(
          "Templated link, it's possible to include {{ metric }} " +
          'or other values coming from the controls.'),
      },
    },
  },

  markup: {
    label: t('Markup'),
    controlPanelSections: [
      {
        label: t('Code'),
        expanded: true,
        controlSetRows: [
          ['markup_type'],
          ['code'],
        ],
      },
    ],
  },

  pivot_table: {
    label: t('Pivot Table'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['groupby', 'columns'],
          ['metrics'],
          ['row_limit', null],
        ],
      },
      {
        label: t('Pivot Options'),
        controlSetRows: [
          ['pandas_aggfunc', 'pivot_margins'],
          ['number_format', 'combine_metric'],
        ],
      },
    ],
    controlOverrides: {
      groupby: { includeTime: true },
      columns: { includeTime: true },
    },
  },

  separator: {
    label: t('Separator'),
    controlPanelSections: [
      {
        label: t('Code'),
        controlSetRows: [
          ['markup_type'],
          ['code'],
        ],
      },
    ],
    controlOverrides: {
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
    label: t('Word Cloud'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['series', 'metric'],
          ['row_limit', null],
        ],
      },
      {
        label: t('Options'),
        controlSetRows: [
          ['size_from', 'size_to'],
          ['rotation'],
          ['color_scheme'],
        ],
      },
    ],
  },

  treemap: {
    label: t('Treemap'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['metrics'],
          ['groupby'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
          ['treemap_ratio'],
          ['number_format'],
        ],
      },
    ],
    controlOverrides: {
      color_scheme: {
        renderTrigger: false,
      },
    },
  },

  cal_heatmap: {
    label: t('Calendar Heatmap'),
    requiresTime: true,
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['domain_granularity', 'subdomain_granularity'],
          ['metrics'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['linear_color_scheme'],
          ['cell_size', 'cell_padding'],
          ['cell_radius', 'steps'],
          ['y_axis_format', 'x_axis_time_format'],
          ['show_legend', 'show_values'],
          ['show_metric_name', null],
        ],
      },
    ],
    controlOverrides: {
      y_axis_format: {
        label: t('Number Format'),
      },
      x_axis_time_format: {
        label: t('Time Format'),
      },
      show_values: {
        default: false,
      },
    },
  },

  box_plot: {
    label: t('Box Plot'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['metrics'],
          ['groupby', 'limit'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
          ['whisker_options'],
        ],
      },
    ],
  },

  bubble: {
    label: t('Bubble Chart'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['series', 'entity'],
          ['x', 'y'],
          ['size', 'max_bubble_size'],
          ['limit', null],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
          ['show_legend', null],
        ],
      },
      {
        label: t('X Axis'),
        expanded: true,
        controlSetRows: [
          ['x_axis_label', 'left_margin'],
          ['x_axis_format', 'x_ticks_layout'],
          ['x_log_scale', 'x_axis_showminmax'],
        ],
      },
      {
        label: t('Y Axis'),
        expanded: true,
        controlSetRows: [
          ['y_axis_label', 'bottom_margin'],
          ['y_axis_format', null],
          ['y_log_scale', 'y_axis_showminmax'],
        ],
      },
    ],
    controlOverrides: {
      x_axis_format: {
        default: '.3s',
      },
      color_scheme: {
        renderTrigger: false,
      },
    },
  },

  bullet: {
    label: t('Bullet Chart'),
    requiresTime: false,
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['metric'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['metric'],
          ['ranges', 'range_labels'],
          ['markers', 'marker_labels'],
          ['marker_lines', 'marker_line_labels'],
        ],
      },
    ],
  },

  big_number: {
    label: t('Big Number with Trendline'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['metric'],
          ['adhoc_filters'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['compare_lag', 'compare_suffix'],
          ['y_axis_format', null],
        ],
      },
    ],
    controlOverrides: {
      y_axis_format: {
        label: t('Number format'),
      },
    },
  },

  big_number_total: {
    label: t('Big Number'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['metric'],
          ['adhoc_filters'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['subheader'],
          ['y_axis_format'],
        ],
      },
    ],
    controlOverrides: {
      y_axis_format: {
        label: t('Number format'),
      },
    },
  },

  histogram: {
    label: t('Histogram'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['all_columns_x'],
          ['row_limit'],
          ['groupby'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
          ['link_length'],
          ['x_axis_label', 'y_axis_label'],
          ['global_opacity'],
          ['normalized'],
        ],
      },
    ],
    controlOverrides: {
      all_columns_x: {
        label: t('Numeric Columns'),
        description: t('Select the numeric columns to draw the histogram'),
        multi: true,
      },
      link_length: {
        label: t('No of Bins'),
        description: t('Select number of bins for the histogram'),
        default: 5,
      },
      global_opacity: {
        description: t('Opacity of the bars. Between 0 and 1'),
        renderTrigger: true,
      },
    },
  },

  sunburst: {
    label: t('Sunburst'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['groupby'],
          ['metric', 'secondary_metric'],
          ['row_limit'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
        ],
      },
    ],
    controlOverrides: {
      metric: {
        label: t('Primary Metric'),
        description: t('The primary metric is used to define the arc segment sizes'),
      },
      secondary_metric: {
        label: t('Secondary Metric'),
        default: null,
        description: t('[optional] this secondary metric is used to ' +
        'define the color as a ratio against the primary metric. ' +
        'When omitted, the color is categorical and based on labels'),
      },
      groupby: {
        label: t('Hierarchy'),
        description: t('This defines the level of the hierarchy'),
      },
    },
  },

  sankey: {
    label: t('Sankey'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['groupby'],
          ['metric'],
          ['row_limit'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
        ],
      },
    ],
    controlOverrides: {
      groupby: {
        label: t('Source / Target'),
        description: t('Choose a source and a target'),
      },
    },
  },

  directed_force: {
    label: t('Directed Force Layout'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['groupby'],
          ['metric'],
          ['row_limit'],
        ],
      },
      {
        label: t('Options'),
        controlSetRows: [
          ['link_length'],
          ['charge'],
        ],
      },
    ],
    controlOverrides: {
      groupby: {
        label: t('Source / Target'),
        description: t('Choose a source and a target'),
      },
    },
  },
  chord: {
    label: t('Chord Diagram'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['groupby', 'columns'],
          ['metric', 'row_limit'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['y_axis_format', null],
          ['color_scheme'],
        ],
      },
    ],
    controlOverrides: {
      y_axis_format: {
        label: t('Number format'),
        description: t('Choose a number format'),
      },
      groupby: {
        label: t('Source'),
        multi: false,
        validators: [v.nonEmpty],
        description: t('Choose a source'),
      },
      columns: {
        label: t('Target'),
        multi: false,
        validators: [v.nonEmpty],
        description: t('Choose a target'),
      },
    },
  },
  country_map: {
    label: t('Country Map'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['entity'],
          ['metric'],
        ],
      },
      {
        label: t('Options'),
        expanded: true,
        controlSetRows: [
          ['select_country', 'number_format'],
          ['linear_color_scheme'],
        ],
      },
    ],
    controlOverrides: {
      entity: {
        label: t('ISO 3166-2 codes of region/province/department'),
        description: t('It\'s ISO 3166-2 of your region/province/department in your table. (see documentation for list of ISO 3166-2)'),
      },
      metric: {
        label: t('Metric'),
        description: 'Metric to display bottom title',
      },
      linear_color_scheme: {
        renderTrigger: false,
      },
    },
  },
  world_map: {
    label: t('World Map'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['entity'],
          ['country_fieldtype'],
          ['metric'],
        ],
      },
      {
        label: t('Bubbles'),
        controlSetRows: [
          ['show_bubbles'],
          ['secondary_metric'],
          ['max_bubble_size'],
        ],
      },
    ],
    controlOverrides: {
      entity: {
        label: t('Country Control'),
        description: t('3 letter code of the country'),
      },
      metric: {
        label: t('Metric for color'),
        description: t('Metric that defines the color of the country'),
      },
      secondary_metric: {
        label: t('Bubble size'),
        description: t('Metric that defines the size of the bubble'),
      },
    },
  },

  filter_box: {
    label: t('Filter Box'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['groupby'],
          ['metric'],
          ['date_filter', 'instant_filtering'],
          ['show_sqla_time_granularity', 'show_sqla_time_column'],
          ['show_druid_time_granularity', 'show_druid_time_origin'],
        ],
      },
    ],
    controlOverrides: {
      groupby: {
        label: t('Filter controls'),
        description: t(
          'The controls you want to filter on. Note that only columns ' +
          'checked as "filterable" will show up on this list.'),
        mapStateToProps: state => ({
          options: (state.datasource) ? state.datasource.columns.filter(c => c.filterable) : [],
        }),
      },
    },
  },

  iframe: {
    label: t('iFrame'),
    controlPanelSections: [
      {
        label: t('Options'),
        controlSetRows: [
          ['url'],
        ],
      },
    ],
  },

  para: {
    label: t('Parallel Coordinates'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['series'],
          ['metrics'],
          ['secondary_metric'],
          ['limit'],
        ],
      },
      {
        label: t('Options'),
        controlSetRows: [
          ['show_datatable', 'include_series'],
        ],
      },
    ],
  },

  heatmap: {
    label: t('Heatmap'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['all_columns_x', 'all_columns_y'],
          ['metric', 'row_limit'],
        ],
      },
      {
        label: t('Heatmap Options'),
        expanded: true,
        controlSetRows: [
          ['linear_color_scheme'],
          ['xscale_interval', 'yscale_interval'],
          ['canvas_image_rendering', 'normalize_across'],
          ['left_margin', 'bottom_margin'],
          ['y_axis_bounds', 'y_axis_format'],
          ['show_legend', 'show_perc'],
          ['show_values', 'normalized'],
          ['sort_x_axis', 'sort_y_axis'],
        ],
      },
    ],
    controlOverrides: {
      all_columns_x: {
        validators: [v.nonEmpty],
      },
      all_columns_y: {
        validators: [v.nonEmpty],
      },
      normalized: t('Whether to apply a normal distribution based on rank on the color scale'),
      y_axis_bounds: {
        label: t('Value bounds'),
        renderTrigger: true,
        description: t(
          'Hard value bounds applied for color coding. Is only relevant ' +
          'and applied when the normalization is applied against the whole heatmap.'),
      },
      y_axis_format: {
        label: t('Value Format'),
      },
    },
  },

  horizon: {
    label: t('Horizon'),
    controlPanelSections: [
      sections.NVD3TimeSeries[0],
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['series_height', 'horizon_color_scale'],
        ],
      },
    ],
  },

  mapbox: {
    label: t('Mapbox'),
    controlPanelSections: [
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [
          ['all_columns_x', 'all_columns_y'],
          ['clustering_radius'],
          ['row_limit'],
          ['groupby'],
        ],
      },
      {
        label: t('Points'),
        controlSetRows: [
          ['point_radius'],
          ['point_radius_unit'],
        ],
      },
      {
        label: t('Labelling'),
        controlSetRows: [
          ['mapbox_label'],
          ['pandas_aggfunc'],
        ],
      },
      {
        label: t('Visual Tweaks'),
        controlSetRows: [
          ['render_while_dragging'],
          ['mapbox_style'],
          ['global_opacity'],
          ['mapbox_color'],
        ],
      },
      {
        label: t('Viewport'),
        controlSetRows: [
          ['viewport_longitude', 'viewport_latitude'],
          ['viewport_zoom', null],
        ],
      },
    ],
    controlOverrides: {
      all_columns_x: {
        label: t('Longitude'),
        description: t('Column containing longitude data'),
      },
      all_columns_y: {
        label: t('Latitude'),
        description: t('Column containing latitude data'),
      },
      pandas_aggfunc: {
        label: t('Cluster label aggregator'),
        description: t('Aggregate function applied to the list of points ' +
          'in each cluster to produce the cluster label.'),
      },
      rich_tooltip: {
        label: t('Tooltip'),
        description: t('Show a tooltip when hovering over points and clusters ' +
          'describing the label'),
      },
      groupby: {
        description: t('One or many controls to group by. If grouping, latitude ' +
          'and longitude columns must be present.'),
      },
    },
  },

  event_flow: {
    label: t('Event flow'),
    requiresTime: true,
    controlPanelSections: [
      {
        label: t('Event definition'),
        controlSetRows: [
          ['entity'],
          ['all_columns_x'],
          ['row_limit'],
          ['order_by_entity'],
          ['min_leaf_node_event_count'],
        ],
      },
      {
        label: t('Additional meta data'),
        controlSetRows: [
          ['all_columns'],
        ],
      },
    ],
    controlOverrides: {
      entity: {
        label: t('Column containing entity ids'),
        description: t('e.g., a "user id" column'),
      },
      all_columns_x: {
        label: t('Column containing event names'),
        validators: [v.nonEmpty],
        default: control => (
          control.choices && control.choices.length > 0 ?
            control.choices[0][0] : null
        ),
      },
      row_limit: {
        label: t('Event count limit'),
        description: t('The maximum number of events to return, equivalent to number of rows'),
      },
      all_columns: {
        label: t('Meta data'),
        description: t('Select any columns for meta data inspection'),
      },
    },
  },

  paired_ttest: {
    label: t('Time Series - Paired t-test'),
    showOnExplore: true,
    requiresTime: true,
    controlPanelSections: [
      sections.NVD3TimeSeries[0],
      {
        label: t('Paired t-test'),
        expanded: false,
        controlSetRows: [
          ['significance_level'],
          ['pvalue_precision'],
          ['liftvalue_precision'],
        ],
      },
    ],
  },

  rose: {
    label: t('Time Series - Nightingale Rose Chart'),
    showOnExplore: true,
    requiresTime: true,
    controlPanelSections: [
      sections.NVD3TimeSeries[0],
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
          ['number_format', 'date_time_format'],
          ['rich_tooltip', 'rose_area_proportion'],
        ],
      },
      sections.NVD3TimeSeries[1],
    ],
  },

  partition: {
    label: 'Partition Diagram',
    showOnExplore: true,
    controlPanelSections: [
      sections.NVD3TimeSeries[0],
      {
        label: t('Time Series Options'),
        expanded: true,
        controlSetRows: [
          ['time_series_option'],
        ],
      },
      {
        label: t('Chart Options'),
        expanded: true,
        controlSetRows: [
          ['color_scheme'],
          ['number_format', 'date_time_format'],
          ['partition_limit', 'partition_threshold'],
          ['log_scale', 'equal_date_size'],
          ['rich_tooltip'],
        ],
      },
      sections.NVD3TimeSeries[1],
    ],
  },
};

export default visTypes;

function adhocFilterEnabled(viz) {
  return viz.controlPanelSections.find((
    section => section.controlSetRows.find(row => row.find(control => control === 'adhoc_filters'))
  ));
}

export function sectionsToRender(vizType, datasourceType) {
  const viz = visTypes[vizType];
  return [].concat(
    sections.datasourceAndVizType,
    datasourceType === 'table' ? sections.sqlaTimeSeries : sections.druidTimeSeries,
    viz.controlPanelSections,
    !adhocFilterEnabled(viz) && (datasourceType === 'table' ? sections.sqlClause : []),
    !adhocFilterEnabled(viz) && (datasourceType === 'table' ? sections.filters[0] : sections.filters),
  ).filter(section => section);
}

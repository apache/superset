import { D3_TIME_FORMAT_OPTIONS } from './controls';
import * as v from '../validators';
import { t } from '../../locales';

export const sections = {
  druidTimeSeries: {
    label: ('Time'),
    labelDisplay: t('Time'),
    expanded: true,
    description: ('Time related form attributes'),
    descriptionDisplay: t('Time related form attributes'),
    controlSetRows: [
      ['granularity', 'druid_time_origin'],
      ['since', 'until'],
    ],
  },
  datasourceAndVizType: {
    label: ('Datasource & Chart Type'),
    labelDisplay: t('Datasource & Chart Type'),
    expanded: true,
    controlSetRows: [
      ['datasource'],
      ['viz_type'],
      ['slice_id', 'cache_timeout'],
    ],
  },
  colorScheme: {
    label: ('Color Scheme'),
    labelDisplay: t('Color Scheme'),
    controlSetRows: [
      ['color_scheme'],
    ],
  },
  sqlaTimeSeries: {
    label: ('Time'),
    labelDisplay: t('Time'),
    description: ('Time related form attributes'),
    descriptionDisplay: t('Time related form attributes'),
    expanded: true,
    controlSetRows: [
      ['granularity_sqla', 'time_grain_sqla'],
      ['since', 'until'],
    ],
  },
  sqlClause: {
    label: ('SQL'),
    labelDisplay: t('SQL'),
    controlSetRows: [
      ['where'],
      ['having'],
    ],
    description: ('This section exposes ways to include snippets of SQL in your query'),
    descriptionDisplay: t('This section exposes ways to include snippets of SQL in your query'),
  },
  NVD3TimeSeries: [
    {
      label: 'Query',
      labelDisplay: t('Query'),
      expanded: true,
      controlSetRows: [
        ['metrics'],
        ['groupby'],
        ['limit', 'timeseries_limit_metric'],
      ],
    },
    {
      label: ('Advanced Analytics'),
      labelDisplay: t('Advanced Analytics'),
      description: ('This section contains options ' +
      'that allow for advanced analytical post processing ' +
      'of query results'),
      descriptionDisplay: t('This section contains options ' +
        'that allow for advanced analytical post processing ' +
        'of query results'),
      controlSetRows: [
        ['rolling_type', 'rolling_periods'],
        ['time_compare'],
        ['num_period_compare', 'period_ratio_type'],
        ['resample_how', 'resample_rule'],
        ['resample_fillmethod'],
      ],
    },
  ],
  filters: [
    {
      label: ('Filters'),
      labelDisplay: t('Filters'),
      expanded: true,
      controlSetRows: [['filters']],
    },
    {
      label: ('Result Filters'),
      labelDisplay: t('Result Filters'),
      expanded: true,
      description: ('The filters to apply after post-aggregation.' +
      'Leave the value control empty to filter empty strings or nulls'),
      controlSetRows: [['having_filters']],
      descriptionDisplay: t('The filters to apply after post-aggregation.' +
        'Leave the value control empty to filter empty strings or nulls'),
    },
  ],
};

export const visTypes = {
  dist_bar: {
    label: ('Distribution - Bar Chart'),
    labelDisplay: t('Distribution - Bar Chart'),
    showOnExplore: true,
    controlPanelSections: [
      {
        label: ('Query'),
        labelDisplay: t('Query'),
        controlSetRows: [
          ['metrics'],
          ['groupby'],
          ['columns'],
          ['row_limit'],
        ],
      },
      {
        label: ('Chart Options'),
        labelDisplay: t('Chart Options'),
        controlSetRows: [
          ['color_scheme'],
          ['show_legend', 'show_bar_value'],
          ['bar_stacked', 'order_bars'],
          ['y_axis_format', 'bottom_margin'],
          ['x_axis_label', 'y_axis_label'],
          ['reduce_x_ticks', 'contribution'],
          ['show_controls'],
        ],
      },
    ],
    controlOverrides: {
      groupby: {
        label: ('Series'),
        labelDisplay: t('Series'),
      },
      columns: {
        label: ('Breakdowns'),
        labelDisplay: t('Breakdowns'),
        description: ('Defines how each series is broken down'),
        descriptionDisplay: t('Defines how each series is broken down'),
      },
    },
  },

  pie: {
    label: ('Pie Chart'),
    labelDisplay: t('Pie Chart'),
    showOnExplore: true,
    controlPanelSections: [
      {
        label: 'Query',
        expanded: true,
        controlSetRows: [
          ['metrics', 'groupby'],
          ['limit'],
        ],
      },
      {
        label: 'Chart Options',
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
    label: ('Time Series - Line Chart'),
    labelDisplay: t('Time Series - Line Chart'),
    showOnExplore: true,
    requiresTime: true,
    controlPanelSections: [
      sections.NVD3TimeSeries[0],
      {
        label: ('Chart Options'),
        labelDisplay: t('Chart Options'),
        controlSetRows: [
          ['color_scheme'],
          ['show_brush', 'show_legend'],
          ['rich_tooltip', 'show_markers'],
          ['line_interpolation', 'contribution'],
        ],
      },
      {
        label: ('X Axis'),
        labelDisplay: t('X Axis'),
        controlSetRows: [
          ['x_axis_label', 'bottom_margin'],
          ['x_axis_showminmax', 'x_axis_format'],
        ],
      },
      {
        label: 'Y Axis',
        controlSetRows: [
          ['y_axis_label', 'left_margin'],
          ['y_axis_showminmax', 'y_log_scale'],
          ['y_axis_format', 'y_axis_bounds'],
        ],
      },
      sections.NVD3TimeSeries[1],
    ],
    controlOverrides: {
      x_axis_format: {
        choices: D3_TIME_FORMAT_OPTIONS,
        default: 'smart_date',
      },
    },
  },

  dual_line: {
    label: ('Dual Axis Line Chart'),
    labelDisplay: t('Dual Axis Line Chart'),
    requiresTime: true,
    controlPanelSections: [
      {
        label: ('Chart Options'),
        labelDisplay: t('Chart Options'),
        controlSetRows: [
          ['color_scheme'],
          ['x_axis_format'],
        ],
      },
      {
        label: ('Y Axis 1'),
        labelDisplay: t('Y Axis 1'),
        controlSetRows: [
          ['metric', 'y_axis_format'],
        ],
      },
      {
        label: ('Y Axis 2'),
        labelDisplay: t('Y Axis 2'),
        controlSetRows: [
          ['metric_2', 'y_axis_2_format'],
        ],
      },
    ],
    controlOverrides: {
      metric: {
        label: ('Left Axis Metric'),
        labelDisplay: t('Left Axis Metric'),
        description: ('Choose a metric for left axis'),
      },
      y_axis_format: {
        label: ('Left Axis Format'),
        labelDisplay: t('Left Axis Format'),
      },
      x_axis_format: {
        choices: D3_TIME_FORMAT_OPTIONS,
        default: 'smart_date',
      },
    },
  },

  bar: {
    label: ('Time Series - Bar Chart'),
    labelDisplay: t('Time Series - Bar Chart'),
    showOnExplore: true,
    requiresTime: true,
    controlPanelSections: [
      sections.NVD3TimeSeries[0],
      {
        label: ('Chart Options'),
        labelDisplay: t('Chart Options'),
        controlSetRows: [
          ['color_scheme'],
          ['show_brush', 'show_legend', 'show_bar_value'],
          ['rich_tooltip', 'contribution'],
          ['line_interpolation', 'bar_stacked'],
          ['bottom_margin', 'show_controls'],
        ],
      },
      {
        label: ('Axes'),
        labelDisplay: t('Axes'),
        controlSetRows: [
          ['x_axis_format', 'y_axis_format'],
          ['x_axis_showminmax', 'reduce_x_ticks'],
          ['x_axis_label', 'y_axis_label'],
          ['y_axis_bounds', 'y_log_scale'],
        ],
      },
      sections.NVD3TimeSeries[1],
    ],
    controlOverrides: {
      x_axis_format: {
        choices: D3_TIME_FORMAT_OPTIONS,
        default: 'smart_date',
      },
    },
  },

  compare: {
    label: ('Time Series - Percent Change'),
    labelDisplay: t('Time Series - Percent Change'),
    requiresTime: true,
    controlPanelSections: [
      sections.NVD3TimeSeries[0],
      {
        label: ('Chart Options'),
        labelDisplay: t('Chart Options'),
        controlSetRows: [
          ['color_scheme'],
          ['x_axis_format', 'y_axis_format'],
        ],
      },
      sections.NVD3TimeSeries[1],
    ],
    controlOverrides: {
      x_axis_format: {
        choices: D3_TIME_FORMAT_OPTIONS,
        default: 'smart_date',
      },
    },
  },

  area: {
    label: ('Time Series - Stacked'),
    labelDisplay: t('Time Series - Stacked'),
    requiresTime: true,
    controlPanelSections: [
      sections.NVD3TimeSeries[0],
      {
        label: ('Chart Options'),
        labelDisplay: t('Chart Options'),
        controlSetRows: [
          ['show_brush', 'show_legend'],
          ['line_interpolation', 'stacked_style'],
          ['color_scheme'],
          ['rich_tooltip', 'contribution'],
          ['show_controls', null],
        ],
      },
      {
        label: ('Axes'),
        labelDisplay: t('Axes'),
        controlSetRows: [
          ['x_axis_format', 'x_axis_showminmax'],
          ['y_axis_format', 'y_axis_bounds'],
          ['y_log_scale', null],
        ],
      },
      sections.NVD3TimeSeries[1],
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
    label: ('Table View'),
    labelDisplay: t('Table View'),
    controlPanelSections: [
      {
        label: ('GROUP BY'),
        labelDisplay: t('GROUP BY'),
        description: ('Use this section if you want a query that aggregates'),
        descriptionDisplay: t('Use this section if you want a query that aggregates'),
        controlSetRows: [
          ['groupby', 'metrics'],
          ['include_time'],
        ],
      },
      {
        label: ('NOT GROUPED BY'),
        labelDisplay: t('NOT GROUPED BY'),
        description: ('Use this section if you want to query atomic rows'),
        descriptionDisplay: t('Use this section if you want to query atomic rows'),
        controlSetRows: [
          ['all_columns'],
          ['order_by_cols'],
        ],
      },
      {
        label: ('Options'),
        labelDisplay: t('Options'),
        controlSetRows: [
          ['table_timestamp_format'],
          ['row_limit', 'page_length'],
          ['include_search', 'table_filter'],
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

  markup: {
    label: ('Markup'),
    labelDisplay: t('Markup'),
    controlPanelSections: [
      {
        label: 'Code',
        controlSetRows: [
          ['markup_type'],
          ['code'],
        ],
      },
    ],
  },

  pivot_table: {
    label: ('Pivot Table'),
    labelDisplay: t('Pivot Table'),
    controlPanelSections: [
      {
        label: 'Query',
        expanded: true,
        controlSetRows: [
          ['groupby', 'columns'],
          ['metrics'],
        ],
      },
      {
        label: 'Pivot Options',
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
    label: ('Separator'),
    labelDisplay: t('Separator'),
    controlPanelSections: [
      {
        label: 'Code',
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
    label: ('Word Cloud'),
    labelDisplay: t('Word Cloud'),
    controlPanelSections: [
      {
        label: 'Query',
        expanded: true,
        controlSetRows: [
          ['series', 'metric', 'limit'],
        ],
      },
      {
        label: 'Options',
        controlSetRows: [
          ['size_from', 'size_to'],
          ['rotation'],
          ['color_scheme'],
        ],
      },
    ],
  },

  treemap: {
    label: ('Treemap'),
    labelDisplay: t('Treemap'),
    controlPanelSections: [
      {
        label: 'Query',
        expanded: true,
        controlSetRows: [
          ['metrics'],
          ['groupby'],
        ],
      },
      {
        label: ('Chart Options'),
        labelDisplay: t('Chart Options'),
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
    label: ('Calendar Heatmap'),
    labelDisplay: t('Calendar Heatmap'),
    requiresTime: true,
    controlPanelSections: [
      {
        label: 'Query',
        expanded: true,
        controlSetRows: [
          ['metric'],
        ],
      },
      {
        label: 'Options',
        controlSetRows: [
          ['domain_granularity'],
          ['subdomain_granularity'],
        ],
      },
    ],
  },

  box_plot: {
    label: ('Box Plot'),
    labelDisplay: t('Box Plot'),
    controlPanelSections: [
      {
        label: 'Query',
        expanded: true,
        controlSetRows: [
          ['metrics'],
          ['groupby', 'limit'],
        ],
      },
      {
        label: ('Chart Options'),
        labelDisplay: t('Chart Options'),
        controlSetRows: [
          ['color_scheme'],
          ['whisker_options'],
        ],
      },
    ],
  },

  bubble: {
    label: ('Bubble Chart'),
    labelDisplay: t('Bubble Chart'),
    controlPanelSections: [
      {
        label: 'Query',
        expanded: true,
        controlSetRows: [
          ['series', 'entity'],
          ['size', 'limit'],
        ],
      },
      {
        label: ('Chart Options'),
        labelDisplay: t('Chart Options'),
        controlSetRows: [
          ['color_scheme'],
          ['show_legend', null],
        ],
      },
      {
        label: ('Bubbles'),
        labelDisplay: t('Bubbles'),
        controlSetRows: [
          ['size', 'max_bubble_size'],
        ],
      },
      {
        label: ('X Axis'),
        labelDisplay: t('X Axis'),
        controlSetRows: [
          ['x_axis_label', 'left_margin'],
          ['x', 'x_axis_format'],
          ['x_log_scale', 'x_axis_showminmax'],
        ],
      },
      {
        label: ('Y Axis'),
        labelDisplay: t('Y Axis'),
        controlSetRows: [
          ['y_axis_label', 'bottom_margin'],
          ['y', 'y_axis_format'],
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
    label: ('Bullet Chart'),
    labelDisplay: t('Bullet Chart'),
    requiresTime: false,
    controlPanelSections: [
      {
        label: 'Query',
        expanded: true,
        controlSetRows: [
          ['metric'],
        ],
      },
      {
        label: 'Chart Options',
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
    label: ('Big Number with Trendline'),
    labelDisplay: t('Big Number with Trendline'),
    controlPanelSections: [
      {
        label: 'Query',
        expanded: true,
        controlSetRows: [
          ['metric'],
        ],
      },
      {
        label: 'Chart Options',
        controlSetRows: [
          ['compare_lag', 'compare_suffix'],
          ['y_axis_format', null],
        ],
      },
    ],
    controlOverrides: {
      y_axis_format: {
        label: ('Number format'),
        labelDisplay: t('Number format'),
      },
    },
  },

  big_number_total: {
    label: ('Big Number'),
    labelDisplay: t('Big Number'),
    controlPanelSections: [
      {
        label: 'Query',
        expanded: true,
        controlSetRows: [
          ['metric'],
        ],
      },
      {
        label: 'Chart Options',
        controlSetRows: [
          ['subheader'],
          ['y_axis_format'],
        ],
      },
    ],
    controlOverrides: {
      y_axis_format: {
        label: ('Number format'),
        labelDisplay: t('Number format'),
      },
    },
  },

  histogram: {
    label: ('Histogram'),
    labelDisplay: t('Histogram'),
    controlPanelSections: [
      {
        label: 'Query',
        expanded: true,
        controlSetRows: [
          ['all_columns_x'],
          ['row_limit'],
        ],
      },
      {
        label: ('Chart Options'),
        labelDisplay: t('Chart Options'),
        controlSetRows: [
          ['color_scheme'],
          ['link_length'],
        ],
      },
    ],
    controlOverrides: {
      all_columns_x: {
        label: ('Numeric Column'),
        labelDisplay: t('Numeric Column'),
        description: ('Select the numeric column to draw the histogram'),
        descriptionDisplay: t('Select the numeric column to draw the histogram'),
      },
      link_length: {
        label: ('No of Bins'),
        labelDisplay: t('No of Bins'),
        description: ('Select number of bins for the histogram'),
        descriptionDisplay: t('Select number of bins for the histogram'),
        default: 5,
      },
    },
  },

  sunburst: {
    label: ('Sunburst'),
    labelDisplay: t('Sunburst'),
    controlPanelSections: [
      {
        label: 'Query',
        expanded: true,
        controlSetRows: [
          ['groupby'],
          ['metric', 'secondary_metric'],
          ['row_limit'],
        ],
      },
      {
        label: 'Chart Options',
        controlSetRows: [
          ['color_scheme'],
        ],
      },
    ],
    controlOverrides: {
      metric: {
        label: ('Primary Metric'),
        labelDisplay: t('Primary Metric'),
        description: ('The primary metric is used to define the arc segment sizes'),
        descriptionDisplay: t('The primary metric is used to define the arc segment sizes'),
      },
      secondary_metric: {
        label: ('Secondary Metric'),
        labelDisplay: t('Secondary Metric'),
        description: ('This secondary metric is used to ' +
        'define the color as a ratio against the primary metric. ' +
        'If the two metrics match, color is mapped level groups'),
        descriptionDisplay: t('This secondary metric is used to ' +
          'define the color as a ratio against the primary metric. ' +
          'If the two metrics match, color is mapped level groups'),
      },
      groupby: {
        label: ('Hierarchy'),
        labelDisplay: t('Hierarchy'),
        description: ('This defines the level of the hierarchy'),
        descriptionDisplay: t('This defines the level of the hierarchy'),
      },
    },
  },

  sankey: {
    label: ('Sankey'),
    labelDisplay: t('Sankey'),
    controlPanelSections: [
      {
        label: 'Query',
        expanded: true,
        controlSetRows: [
          ['groupby'],
          ['metric'],
          ['row_limit'],
        ],
      },
      {
        label: 'Chart Options',
        controlSetRows: [
          ['color_scheme'],
        ],
      },
    ],
    controlOverrides: {
      groupby: {
        label: ('Source / Target'),
        labelDisplay: t('Source / Target'),
        description: ('Choose a source and a target'),
        descriptionDisplay: t('Choose a source and a target'),
      },
    },
  },

  directed_force: {
    label: ('Directed Force Layout'),
    labelDisplay: t('Directed Force Layout'),
    controlPanelSections: [
      {
        label: 'Query',
        expanded: true,
        controlSetRows: [
          ['groupby'],
          ['metric'],
          ['row_limit'],
        ],
      },
      {
        label: ('Options'),
        labelDisplay: t('Options'),
        controlSetRows: [
          ['link_length'],
          ['charge'],
        ],
      },
    ],
    controlOverrides: {
      groupby: {
        label: ('Source / Target'),
        labelDisplay: t('Source / Target'),
        description: ('Choose a source and a target'),
        descriptionDisplay: t('Choose a source and a target'),
      },
    },
  },
  chord: {
    label: ('Chord Diagram'),
    labelDisplay: t('Chord Diagram'),
    controlPanelSections: [
      {
        label: 'Query',
        expanded: true,
        controlSetRows: [
          ['groupby', 'columns'],
          ['metric', 'row_limit'],
        ],
      },
      {
        label: 'Chart Options',
        controlSetRows: [
          ['y_axis_format', null],
          ['color_scheme'],
        ],
      },
    ],
    controlOverrides: {
      y_axis_format: {
        label: ('Number format'),
        labelDisplay: t('Number format'),
        description: ('Choose a number format'),
        descriptionDisplay: t('Choose a number format'),
      },
      groupby: {
        label: ('Source'),
        labelDisplay: t('Source'),
        multi: false,
        validators: [v.nonEmpty],
        description: ('Choose a source'),
        descriptionDisplay: t('Choose a source'),
      },
      columns: {
        label: ('Target'),
        labelDisplay: t('Target'),
        multi: false,
        validators: [v.nonEmpty],
        description: ('Choose a target'),
        descriptionDisplay: t('Choose a target'),
      },
    },
  },
  country_map: {
    label: ('Country Map'),
    labelDisplay: t('Country Map'),
    controlPanelSections: [
      {
        label: 'Query',
        expanded: true,
        controlSetRows: [
          ['entity'],
          ['metric'],
        ],
      },
      {
        label: 'Options',
        controlSetRows: [
          ['select_country'],
          ['linear_color_scheme'],
        ],
      },
    ],
    controlOverrides: {
      entity: {
        label: ('ISO 3166-1 codes of region/province/department'),
        labelDisplay: t('ISO 3166-1 codes of region/province/department'),
        description: ('It\'s ISO 3166-1 of your region/province/department in your table. (see documentation for list of ISO 3166-1)'),
        descriptionDisplay: t('It\'s ISO 3166-1 of your region/province/department in your table. (see documentation for list of ISO 3166-1)'),
      },
      metric: {
        label: ('Metric'),
        labelDisplay: t('Metric'),
        description: ('Metric to display bottom title'),
        descriptionDisplay: t('Metric to display bottom title'),
      },
      linear_color_scheme: {
        renderTrigger: false,
      },
    },
  },
  world_map: {
    label: ('World Map'),
    labelDisplay: t('World Map'),
    controlPanelSections: [
      {
        label: 'Query',
        expanded: true,
        controlSetRows: [
          ['entity'],
          ['country_fieldtype'],
          ['metric'],
        ],
      },
      {
        label: ('Bubbles'),
        labelDisplay: t('Bubbles'),
        controlSetRows: [
          ['show_bubbles'],
          ['secondary_metric'],
          ['max_bubble_size'],
        ],
      },
    ],
    controlOverrides: {
      entity: {
        label: ('Country Control'),
        labelDisplay: t('Country Control'),
        description: ('3 letter code of the country'),
        descriptionDisplay: t('3 letter code of the country'),
      },
      metric: {
        label: ('Metric for color'),
        labelDisplay: t('Metric for color'),
        description: ('Metric that defines the color of the country'),
        descriptionDisplay: t('Metric that defines the color of the country'),
      },
      secondary_metric: {
        label: ('Bubble size'),
        labelDisplay: t('Bubble size'),
        description: ('Metric that defines the size of the bubble'),
        descriptionDisplay: t('Metric that defines the size of the bubble'),
      },
    },
  },

  filter_box: {
    label: ('Filter Box'),
    labelDisplay: t('Filter Box'),
    controlPanelSections: [
      {
        label: 'Query',
        expanded: true,
        controlSetRows: [
          ['groupby'],
          ['metric'],
        ],
      },
      {
        label: 'Options',
        controlSetRows: [
          ['date_filter', 'instant_filtering'],
        ],
      },
    ],
    controlOverrides: {
      groupby: {
        label: ('Filter controls'),
        labelDisplay: t('Filter controls'),
        description: ('The controls you want to filter on. Note that only columns ' +
        'checked as "filterable" will show up on this list.'),
        descriptionDisplay: t('The controls you want to filter on. Note that only columns ' +
          'checked as "filterable" will show up on this list.'),
        mapStateToProps: state => ({
          options: (state.datasource) ? state.datasource.columns.filter(c => c.filterable) : [],
        }),
      },
    },
  },

  iframe: {
    label: ('iFrame'),
    labelDisplay: t('iFrame'),
    controlPanelSections: [
      {
        label: 'Options',
        controlSetRows: [
          ['url'],
        ],
      },
    ],
  },

  para: {
    label: ('Parallel Coordinates'),
    labelDisplay: t('Parallel Coordinates'),
    controlPanelSections: [
      {
        label: 'Query',
        expanded: true,
        controlSetRows: [
          ['series'],
          ['metrics'],
          ['secondary_metric'],
          ['limit'],
        ],
      },
      {
        label: 'Options',
        controlSetRows: [
          ['show_datatable', 'include_series'],
        ],
      },
    ],
  },

  heatmap: {
    label: ('Heatmap'),
    labelDisplay: t('Heatmap'),
    controlPanelSections: [
      {
        label: ('Axis & Metrics'),
        labelDisplay: t('Axis & Metrics'),
        controlSetRows: [
          ['all_columns_x'],
          ['all_columns_y'],
          ['metric'],
        ],
      },
      {
        label: ('Heatmap Options'),
        labelDisplay: t('Heatmap Options'),
        controlSetRows: [
          ['linear_color_scheme'],
          ['xscale_interval', 'yscale_interval'],
          ['canvas_image_rendering'],
          ['normalize_across'],
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
    },
  },

  horizon: {
    label: ('Horizon'),
    labelDisplay: t('Horizon'),
    controlPanelSections: [
      sections.NVD3TimeSeries[0],
      {
        label: ('Chart Options'),
        labelDisplay: t('Chart Options'),
        controlSetRows: [
          ['series_height', 'horizon_color_scale'],
        ],
      },
    ],
  },

  mapbox: {
    label: ('Mapbox'),
    labelDisplay: t('Mapbox'),
    controlPanelSections: [
      {
        label: 'Query',
        expanded: true,
        controlSetRows: [
          ['all_columns_x', 'all_columns_y'],
          ['clustering_radius'],
          ['row_limit'],
          ['groupby'],
        ],
      },
      {
        label: ('Points'),
        labelDisplay: t('Points'),
        controlSetRows: [
          ['point_radius'],
          ['point_radius_unit'],
        ],
      },
      {
        label: ('Labelling'),
        labelDisplay: t('Labelling'),
        controlSetRows: [
          ['mapbox_label'],
          ['pandas_aggfunc'],
        ],
      },
      {
        label: ('Visual Tweaks'),
        labelDisplay: t('Visual Tweaks'),
        controlSetRows: [
          ['render_while_dragging'],
          ['mapbox_style'],
          ['global_opacity'],
          ['mapbox_color'],
        ],
      },
      {
        label: ('Viewport'),
        labelDisplay: t('Viewport'),
        controlSetRows: [
          ['viewport_longitude'],
          ['viewport_latitude'],
          ['viewport_zoom'],
        ],
      },
    ],
    controlOverrides: {
      all_columns_x: {
        label: ('Longitude'),
        labelDisplay: t('Longitude'),
        description: ('Column containing longitude data'),
        descriptionDisplay: t('Column containing longitude data'),
      },
      all_columns_y: {
        label: ('Latitude'),
        labelDisplay: t('Latitude'),
        description: ('Column containing latitude data'),
        descriptionDisplay: t('Column containing latitude data'),
      },
      pandas_aggfunc: {
        label: ('Cluster label aggregator'),
        labelDisplay: t('Cluster label aggregator'),
        description: ('Aggregate function applied to the list of points ' +
        'in each cluster to produce the cluster label.'),
        descriptionDisplay: t('Aggregate function applied to the list of points ' +
          'in each cluster to produce the cluster label.'),
      },
      rich_tooltip: {
        label: ('Tooltip'),
        labelDisplay: t('Tooltip'),
        description: ('Show a tooltip when hovering over points and clusters ' +
        'describing the label'),
        descriptionDisplay: t('Show a tooltip when hovering over points and clusters ' +
          'describing the label'),
      },
      groupby: {
        description: ('One or many controls to group by. If grouping, latitude ' +
        'and longitude columns must be present.'),
        descriptionDisplay: t('One or many controls to group by. If grouping, latitude ' +
          'and longitude columns must be present.'),
      },
    },
  },

  event_flow: {
    label: ('Event flow'),
    labelDisplay: t('Event flow'),
    requiresTime: true,
    controlPanelSections: [
      {
        label: ('Event definition'),
        labelDisplay: t('Event definition'),
        controlSetRows: [
          ['entity'],
          ['all_columns_x'],
          ['row_limit'],
          ['order_by_entity'],
          ['min_leaf_node_event_count'],
        ],
      },
      {
        label: ('Additional meta data'),
        labelDisplay: t('Additional meta data'),
        controlSetRows: [
          ['all_columns'],
        ],
      },
    ],
    controlOverrides: {
      entity: {
        label: ('Column containing entity ids'),
        labelDisplay: t('Column containing entity ids'),
        description: ('e.g., a "user id" column'),
        descriptionDisplay: t('e.g., a "user id" column'),
      },
      all_columns_x: {
        label: ('Column containing event names'),
        labelDisplay: t('Column containing event names'),
        validators: [v.nonEmpty],
        default: control => (
          control.choices && control.choices.length > 0 ?
            control.choices[0][0] : null
        ),
      },
      row_limit: {
        label: ('Event count limit'),
        labelDisplay: t('Event count limit'),
        description: ('The maximum number of events to return, equivalent to number of rows'),
        descriptionDisplay: t('The maximum number of events to return, equivalent to number of rows'),
      },
      all_columns: {
        label: ('Meta data'),
        labelDisplay: t('Meta data'),
        description: ('Select any columns for meta data inspection'),
        descriptionDisplay: t('Select any columns for meta data inspection'),
      },
    },
  },
};

export default visTypes;

export function sectionsToRender(vizType, datasourceType) {
  const viz = visTypes[vizType];
  return [].concat(
    sections.datasourceAndVizType,
    datasourceType === 'table' ? sections.sqlaTimeSeries : sections.druidTimeSeries,
    viz.controlPanelSections,
    datasourceType === 'table' ? sections.sqlClause : [],
    datasourceType === 'table' ? sections.filters[0] : sections.filters,
  );
}

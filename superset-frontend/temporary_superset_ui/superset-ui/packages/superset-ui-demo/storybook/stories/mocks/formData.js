/* eslint sort-keys: 'off' */
/** The form data defined here is based on default visualizations packaged with Apache Superset */

export const bigNumberFormData = {
  datasource: '3__table',
  viz_type: 'big_number',
  slice_id: 54,
  granularity_sqla: 'ds',
  time_grain_sqla: 'P1D',
  time_range: '100 years ago : now',
  metric: 'sum__num',
  adhoc_filters: [],
  compare_lag: '5',
  compare_suffix: 'over 5Y',
  y_axis_format: '.3s',
  show_trend_line: true,
  start_y_axis_at_zero: true,
};

export const wordCloudFormData = {
  datasource: '3__table',
  viz_type: 'word_cloud',
  slice_id: 60,
  url_params: {},
  granularity_sqla: 'ds',
  time_grain_sqla: 'P1D',
  time_range: '100 years ago : now',
  series: 'name',
  metric: 'sum__num',
  adhoc_filters: [],
  row_limit: 50,
  size_from: 10,
  size_to: 70,
  rotation: 'square',
};

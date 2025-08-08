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

import type { CustomControlItem } from '../../types';
import sharedControls from '../sharedControls';

/**
 * React component wrappers for shared controls.
 * These replace string references like ['metrics'] with actual component calls.
 */

// Metrics controls
export const MetricsControl = (): CustomControlItem => ({
  name: 'metrics',
  config: sharedControls.metrics,
});

export const MetricControl = (): CustomControlItem => ({
  name: 'metric',
  config: sharedControls.metric,
});

export const SecondaryMetricControl = (): CustomControlItem => ({
  name: 'secondary_metric',
  config: sharedControls.secondary_metric,
});

export const Metric2Control = (): CustomControlItem => ({
  name: 'metric_2',
  config: sharedControls.metric_2,
});

export const TimeLimitMetricControl = (): CustomControlItem => ({
  name: 'timeseries_limit_metric',
  config: sharedControls.timeseries_limit_metric,
});

export const OrderByControl = (): CustomControlItem => ({
  name: 'orderby',
  config: sharedControls.orderby,
});

export const SeriesLimitMetricControl = (): CustomControlItem => ({
  name: 'series_limit_metric',
  config: sharedControls.series_limit_metric,
});

export const SortByMetricControl = (): CustomControlItem => ({
  name: 'sort_by_metric',
  config: sharedControls.sort_by_metric,
});

// Dimension controls
export const GroupByControl = (): CustomControlItem => ({
  name: 'groupby',
  config: sharedControls.groupby,
});

export const ColumnsControl = (): CustomControlItem => ({
  name: 'columns',
  config: sharedControls.columns,
});

// Note: These controls are not in sharedControls, using columns as fallback
export const AllColumnsControl = (): CustomControlItem => ({
  name: 'all_columns',
  config: sharedControls.columns || {},
});

export const AllColumnsXControl = (): CustomControlItem => ({
  name: 'all_columns_x',
  config: sharedControls.columns || {},
});

export const AllColumnsYControl = (): CustomControlItem => ({
  name: 'all_columns_y',
  config: sharedControls.columns || {},
});

export const SeriesControl = (): CustomControlItem => ({
  name: 'series',
  config: sharedControls.series,
});

export const EntityControl = (): CustomControlItem => ({
  name: 'entity',
  config: sharedControls.entity,
});

export const XControl = (): CustomControlItem => ({
  name: 'x',
  config: sharedControls.x,
});

export const YControl = (): CustomControlItem => ({
  name: 'y',
  config: sharedControls.y,
});

// Note: sort_by is not in sharedControls, using a default config
export const SortByControl = (): CustomControlItem => ({
  name: 'sort_by',
  config: {
    type: 'SelectControl',
    label: 'Sort By',
    description: 'Sort by column',
  },
});

export const SizeControl = (): CustomControlItem => ({
  name: 'size',
  config: sharedControls.size,
});

export const XAxisControl = (): CustomControlItem => ({
  name: 'x_axis',
  config: sharedControls.x_axis,
});

// Filter controls
export const AdhocFiltersControl = (): CustomControlItem => ({
  name: 'adhoc_filters',
  config: sharedControls.adhoc_filters,
});

export const TimeRangeControl = (): CustomControlItem => ({
  name: 'time_range',
  config: sharedControls.time_range,
});

export const TimeGrainSqlaControl = (): CustomControlItem => ({
  name: 'time_grain_sqla',
  config: sharedControls.time_grain_sqla,
});

export const GranularityControl = (): CustomControlItem => ({
  name: 'granularity',
  config: sharedControls.granularity,
});

export const GranularitySqlaControl = (): CustomControlItem => ({
  name: 'granularity_sqla',
  config: sharedControls.granularity_sqla,
});

// Limit controls
export const RowLimitControl = (): CustomControlItem => ({
  name: 'row_limit',
  config: sharedControls.row_limit,
});

export const LimitControl = (): CustomControlItem => ({
  name: 'limit',
  config: sharedControls.limit,
});

export const GroupOthersWhenLimitReachedControl = (): CustomControlItem => ({
  name: 'group_others_when_limit_reached',
  config: sharedControls.group_others_when_limit_reached,
});

export const SeriesLimitControl = (): CustomControlItem => ({
  name: 'series_limit',
  config: sharedControls.series_limit,
});

// Sort controls
export const OrderDescControl = (): CustomControlItem => ({
  name: 'order_desc',
  config: sharedControls.order_desc,
});

export const OrderByColsControl = (): CustomControlItem => ({
  name: 'order_by_cols',
  config: sharedControls.order_by_cols,
});

// Color controls
export const ColorSchemeControl = (): CustomControlItem => ({
  name: 'color_scheme',
  config: sharedControls.color_scheme,
});

export const LinearColorSchemeControl = (): CustomControlItem => ({
  name: 'linear_color_scheme',
  config: sharedControls.linear_color_scheme,
});

export const ColorPickerControl = (): CustomControlItem => ({
  name: 'color_picker',
  config: sharedControls.color_picker,
});

export const TimeShiftColorControl = (): CustomControlItem => ({
  name: 'time_shift_color',
  config: sharedControls.time_shift_color,
});

export const CurrencyFormatControl = (): CustomControlItem => ({
  name: 'currency_format',
  config: sharedControls.currency_format,
});

export const TruncateMetricControl = (): CustomControlItem => ({
  name: 'truncate_metric',
  config: sharedControls.truncate_metric,
});

export const ShowEmptyColumnsControl = (): CustomControlItem => ({
  name: 'show_empty_columns',
  config: sharedControls.show_empty_columns,
});

// Other controls
export const ZoomableControl = (): CustomControlItem => ({
  name: 'zoomable',
  config: sharedControls.zoomable,
});

export const DatasourceControl = (): CustomControlItem => ({
  name: 'datasource',
  config: sharedControls.datasource,
});

export const VizTypeControl = (): CustomControlItem => ({
  name: 'viz_type',
  config: sharedControls.viz_type,
});

// Tooltip controls
export const TooltipColumnsControl = (): CustomControlItem => ({
  name: 'tooltip_columns',
  config: sharedControls.tooltip_columns,
});

export const TooltipMetricsControl = (): CustomControlItem => ({
  name: 'tooltip_metrics',
  config: sharedControls.tooltip_metrics,
});

// Format controls
export const YAxisFormatControl = (): CustomControlItem => ({
  name: 'y_axis_format',
  config: sharedControls.y_axis_format,
});

export const XAxisTimeFormatControl = (): CustomControlItem => ({
  name: 'x_axis_time_format',
  config: sharedControls.x_axis_time_format,
});

// Hidden controls
export const TemporalColumnsLookupControl = (): CustomControlItem => ({
  name: 'temporal_columns_lookup',
  config: sharedControls.temporal_columns_lookup,
});

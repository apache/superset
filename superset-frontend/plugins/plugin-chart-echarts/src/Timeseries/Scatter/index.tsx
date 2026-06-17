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
 * Timeseries Scatter Chart - Glyph Pattern Implementation
 *
 * A scatter plot for time series data. Points are placed based on
 * x-axis (typically time) and y-axis (metric value) coordinates.
 *
 * Key characteristics:
 * - seriesType is fixed to 'scatter' (not configurable)
 * - No stack support (scatter plots don't stack)
 * - No area support (scatter plots are discrete points)
 * - Markers are always shown (they ARE the data points)
 * - Supports cross-filtering, drill-to-detail, and drill-by
 */

import { t } from '@apache-superset/core/translation';
import { AnnotationType, Behavior, ChartProps } from '@superset-ui/core';
import {
  DEFAULT_SORT_SERIES_DATA,
  SORT_SERIES_CHOICES,
} from '@superset-ui/chart-controls';

import { defineChart } from '@superset-ui/glyph-core';
import { Checkbox, Slider, Select } from '@superset-ui/glyph-core';
import {
  EchartsTimeseriesChartProps,
  EchartsTimeseriesSeriesType,
  TimeseriesChartTransformedProps,
} from '../types';
import { DEFAULT_FORM_DATA } from '../constants';
import buildQuery from '../buildQuery';
import {
  transformSimpleTimeseriesProps,
  TimeseriesRender,
  timeseriesQueryControls,
  timeseriesBaseChartOptions,
  markerDirectRow,
  legendZoomRows,
  xAxisRows,
  richTooltipSection,
  yAxisRows,
} from '../shared';

import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example1 from './images/Scatter1.png';
import example1Dark from './images/Scatter1-dark.png';

// ============================================================================
// Types
// ============================================================================

interface ScatterTransformResult {
  transformedProps: TimeseriesChartTransformedProps;
}

// ============================================================================
// Constants
// ============================================================================

const { logAxis, markerSize, minorSplitLine, rowLimit, truncateYAxis } =
  DEFAULT_FORM_DATA;

// ============================================================================
// Chart Definition
// ============================================================================

export default defineChart({
  metadata: {
    name: t('Scatter Plot'),
    description: t(
      'Scatter Plot has the horizontal axis in linear units, and the points are connected in order. It shows a statistical relationship between two variables.',
    ),
    category: t('Evolution'),
    tags: [
      t('ECharts'),
      t('Predictive'),
      t('Advanced-Analytics'),
      t('Time'),
      t('Transformable'),
      t('Scatter'),
      t('Featured'),
    ],
    credits: ['https://echarts.apache.org'],
    thumbnail,
    thumbnailDark,
    exampleGallery: [{ url: example1, urlDark: example1Dark }],
    behaviors: [
      Behavior.InteractiveChart,
      Behavior.DrillToDetail,
      Behavior.DrillBy,
    ],
    supportedAnnotationTypes: [
      AnnotationType.Event,
      AnnotationType.Formula,
      AnnotationType.Interval,
      AnnotationType.Timeseries,
    ],
  },

  arguments: {
    // Marker size control (scatter always shows markers)
    markerSize: Slider.with({
      label: t('Marker Size'),
      description: t('Size of marker. Also applies to forecast observations.'),
      default: markerSize,
      min: 0,
      max: 100,
      step: 1,
    }),

    // Show value control
    showValue: Checkbox.with({
      label: t('Show Value'),
      description: t('Show series values on the chart'),
      default: false,
    }),

    // Zoom control
    zoomable: Checkbox.with({
      label: t('Data Zoom'),
      description: t('Enable data zooming controls'),
      default: false,
    }),

    // Y-Axis controls
    logAxis: Checkbox.with({
      label: t('Logarithmic Y-axis'),
      description: t('Logarithmic y-axis'),
      default: logAxis,
    }),

    minorSplitLine: Checkbox.with({
      label: t('Minor Split Line'),
      description: t('Draw split lines for minor y-axis ticks'),
      default: minorSplitLine,
    }),

    truncateYAxis: Checkbox.with({
      label: t('Truncate Y Axis'),
      description: t(
        'Truncate Y Axis. Can be overridden by specifying a min or max bound.',
      ),
      default: truncateYAxis,
    }),

    // Series order controls
    sortSeriesType: Select.with({
      label: t('Sort Series By'),
      description: t(
        'Based on what should series be ordered on the chart and legend',
      ),
      options: SORT_SERIES_CHOICES.map(([value, label]) => ({
        value,
        label,
      })),
      default: DEFAULT_SORT_SERIES_DATA.sort_series_type,
    }),

    sortSeriesAscending: Checkbox.with({
      label: t('Sort Series Ascending'),
      description: t('Sort series in ascending order'),
      default: DEFAULT_SORT_SERIES_DATA.sort_series_ascending,
    }),
  },

  additionalControls: {
    query: timeseriesQueryControls,
    chartOptions: [
      ...timeseriesBaseChartOptions,
      ...markerDirectRow,
      ...legendZoomRows,
      ...xAxisRows,
      ...richTooltipSection,
      ...yAxisRows,
    ],
  },

  controlOverrides: {
    row_limit: {
      default: rowLimit,
    },
  },

  buildQuery,

  transform: (chartProps: ChartProps): ScatterTransformResult => {
    const transformedProps = transformSimpleTimeseriesProps(
      chartProps as unknown as EchartsTimeseriesChartProps,
      EchartsTimeseriesSeriesType.Scatter,
      { alwaysShowMarkers: true },
    );
    return { transformedProps };
  },

  render: ({ transformedProps }) => (
    <TimeseriesRender transformedProps={transformedProps} />
  ),
});

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
 * Timeseries Area Chart - Glyph Pattern Implementation
 *
 * Area charts are similar to line charts in that they represent variables
 * with the same scale, but area charts stack the metrics on top of each other.
 *
 * Key characteristics:
 * - area is always enabled (hardcoded true)
 * - seriesType is configurable (Line, Smooth, Step variants)
 * - Supports stacking (Stack, Stream, Expand modes)
 * - Supports configurable area opacity
 * - Markers are optional (toggle with markerEnabled)
 * - Supports cross-filtering, drill-to-detail, and drill-by
 * - Has ExtraControls for area stack radio buttons
 */

import { t } from '@apache-superset/core/translation';
import { AnnotationType, Behavior, ChartProps } from '@superset-ui/core';
import {
  ControlPanelsContainerProps,
  ControlSubSectionHeader,
  D3_TIME_FORMAT_DOCS,
  DEFAULT_SORT_SERIES_DATA,
  getStandardizedControls,
  sharedControls,
  SORT_SERIES_CHOICES,
} from '@superset-ui/chart-controls';

import { defineChart } from '@superset-ui/glyph-core';
import { Checkbox, Slider, Select } from '@superset-ui/glyph-core';
import {
  EchartsTimeseriesChartProps,
  EchartsTimeseriesSeriesType,
  TimeseriesChartTransformedProps,
} from '../types';
import { DEFAULT_FORM_DATA, TIME_SERIES_DESCRIPTION_TEXT } from '../constants';
import buildQuery from '../buildQuery';
import {
  legendSection,
  minorTicks,
  onlyTotalControl,
  percentageThresholdControl,
  richTooltipSection,
  showValueControl,
  truncateXAxis,
  xAxisBounds,
  xAxisLabelRotation,
  xAxisLabelInterval,
  forceMaxInterval,
} from '../../controls';
import { AreaChartStackControlOptions } from '../../constants';
import {
  transformFullTimeseriesProps,
  TimeseriesRender,
  timeseriesQueryControls,
  timeseriesBaseChartOptions,
  markerConditionalRows,
} from '../shared';

import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example1 from './images/Area1.png';
import example1Dark from './images/Area1-dark.png';

// ============================================================================
// Types
// ============================================================================

interface AreaTransformResult {
  transformedProps: TimeseriesChartTransformedProps;
}

// ============================================================================
// Constants
// ============================================================================

const {
  logAxis,
  markerEnabled,
  markerSize,
  minorSplitLine,
  opacity,
  rowLimit,
  seriesType,
  truncateYAxis,
  yAxisBounds,
} = DEFAULT_FORM_DATA;

// ============================================================================
// Chart Definition
// ============================================================================

export default defineChart({
  metadata: {
    name: t('Area Chart'),
    description: t(
      'Area charts are similar to line charts in that they represent variables with the same scale, but area charts stack the metrics on top of each other.',
    ),
    category: t('Evolution'),
    tags: [
      t('ECharts'),
      t('Predictive'),
      t('Advanced-Analytics'),
      t('Time'),
      t('Line'),
      t('Transformable'),
      t('Stacked'),
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
    // Series style
    seriesType: Select.with({
      label: t('Series Style'),
      description: t('Series chart type (line, bar etc)'),
      options: [
        { value: EchartsTimeseriesSeriesType.Line, label: t('Line') },
        { value: EchartsTimeseriesSeriesType.Smooth, label: t('Smooth Line') },
        { value: EchartsTimeseriesSeriesType.Start, label: t('Step - start') },
        {
          value: EchartsTimeseriesSeriesType.Middle,
          label: t('Step - middle'),
        },
        { value: EchartsTimeseriesSeriesType.End, label: t('Step - end') },
      ],
      default: seriesType,
    }),

    // Marker controls
    markerEnabled: Checkbox.with({
      label: t('Marker'),
      description: t(
        'Draw a marker on data points. Only applicable for line types.',
      ),
      default: markerEnabled,
    }),

    markerSize: {
      arg: Slider.with({
        label: t('Marker Size'),
        description: t(
          'Size of marker. Also applies to forecast observations.',
        ),
        default: markerSize,
        min: 0,
        max: 20,
        step: 1,
      }),
      visibleWhen: { markerEnabled: true },
    },

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
      [
        {
          name: 'seriesType',
          config: {
            type: 'SelectControl',
            label: t('Series Style'),
            renderTrigger: true,
            default: seriesType,
            choices: [
              [EchartsTimeseriesSeriesType.Line, t('Line')],
              [EchartsTimeseriesSeriesType.Smooth, t('Smooth Line')],
              [EchartsTimeseriesSeriesType.Start, t('Step - start')],
              [EchartsTimeseriesSeriesType.Middle, t('Step - middle')],
              [EchartsTimeseriesSeriesType.End, t('Step - end')],
            ],
            description: t('Series chart type (line, bar etc)'),
          },
        },
      ],
      [
        {
          name: 'opacity',
          config: {
            type: 'SliderControl',
            label: t('Area chart opacity'),
            renderTrigger: true,
            min: 0,
            max: 1,
            step: 0.1,
            default: opacity,
            description: t(
              'Opacity of Area Chart. Also applies to confidence band.',
            ),
          },
        },
      ],
      [showValueControl],
      [
        {
          name: 'stack',
          config: {
            type: 'SelectControl',
            label: t('Stacked Style'),
            renderTrigger: true,
            choices: AreaChartStackControlOptions,
            default: null,
            description: t('Stack series on top of each other'),
          },
        },
      ],
      [onlyTotalControl],
      [percentageThresholdControl],
      [
        {
          name: 'show_extra_controls',
          config: {
            type: 'CheckboxControl',
            label: t('Extra Controls'),
            renderTrigger: true,
            default: false,
            description: t(
              'Whether to show extra controls or not. Extra controls ' +
                'include things like making multiBar charts stacked ' +
                'or side by side.',
            ),
          },
        },
      ],
      ...markerConditionalRows,
      [minorTicks],
      ['zoomable'],
      ...legendSection,
      [
        <ControlSubSectionHeader key="xaxis">
          {t('X Axis')}
        </ControlSubSectionHeader>,
      ],
      [
        {
          name: 'x_axis_time_format',
          config: {
            ...sharedControls.x_axis_time_format,
            default: 'smart_date',
            description: `${D3_TIME_FORMAT_DOCS}. ${TIME_SERIES_DESCRIPTION_TEXT}`,
          },
        },
      ],
      [xAxisLabelRotation],
      [xAxisLabelInterval],
      [forceMaxInterval],
      ...richTooltipSection,
      [
        <ControlSubSectionHeader key="yaxis">
          {t('Y Axis')}
        </ControlSubSectionHeader>,
      ],
      ['y_axis_format'],
      ['currency_format'],
      [
        {
          name: 'logAxis',
          config: {
            type: 'CheckboxControl',
            label: t('Logarithmic y-axis'),
            renderTrigger: true,
            default: logAxis,
            description: t('Logarithmic y-axis'),
          },
        },
      ],
      [
        {
          name: 'minorSplitLine',
          config: {
            type: 'CheckboxControl',
            label: t('Minor Split Line'),
            renderTrigger: true,
            default: minorSplitLine,
            description: t('Draw split lines for minor y-axis ticks'),
          },
        },
      ],
      [truncateXAxis],
      [xAxisBounds],
      [
        {
          name: 'truncateYAxis',
          config: {
            type: 'CheckboxControl',
            label: t('Truncate Y Axis'),
            default: truncateYAxis,
            renderTrigger: true,
            description: t(
              'Truncate Y Axis. Can be overridden by specifying a min or max bound.',
            ),
          },
        },
      ],
      [
        {
          name: 'y_axis_bounds',
          config: {
            type: 'BoundsControl',
            label: t('Y Axis Bounds'),
            renderTrigger: true,
            default: yAxisBounds,
            description: t(
              'Bounds for the Y-axis. When left empty, the bounds are ' +
                'dynamically defined based on the min/max of the data. Note that ' +
                "this feature will only expand the axis range. It won't " +
                "narrow the data's extent.",
            ),
            visibility: ({ controls }: ControlPanelsContainerProps) =>
              Boolean(controls?.truncateYAxis?.value),
          },
        },
      ],
    ],
  },

  controlOverrides: {
    row_limit: {
      default: rowLimit,
    },
  },

  formDataOverrides: formData => ({
    ...formData,
    metrics: getStandardizedControls().popAllMetrics(),
    groupby: getStandardizedControls().popAllColumns(),
  }),

  buildQuery,

  transform: (chartProps: ChartProps): AreaTransformResult => {
    const transformedProps = transformFullTimeseriesProps(
      chartProps as unknown as EchartsTimeseriesChartProps,
      { area: true },
    );
    return { transformedProps };
  },

  render: ({ transformedProps }) => (
    <TimeseriesRender transformedProps={transformedProps} hasExtraControls />
  ),
});

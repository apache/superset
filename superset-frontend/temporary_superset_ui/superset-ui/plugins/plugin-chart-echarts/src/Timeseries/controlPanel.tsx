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
import React from 'react';
import {
  FeatureFlag,
  isFeatureEnabled,
  legacyValidateInteger,
  legacyValidateNumber,
  t,
} from '@superset-ui/core';
import {
  ControlPanelConfig,
  ControlPanelsContainerProps,
  D3_TIME_FORMAT_DOCS,
  sections,
  sharedControls,
} from '@superset-ui/chart-controls';

import {
  DEFAULT_FORM_DATA,
  EchartsTimeseriesContributionType,
  EchartsTimeseriesSeriesType,
} from './types';
import { legendSection } from '../controls';

const {
  area,
  annotationLayers,
  contributionMode,
  emitFilter,
  forecastEnabled,
  forecastInterval,
  forecastPeriods,
  forecastSeasonalityDaily,
  forecastSeasonalityWeekly,
  forecastSeasonalityYearly,
  logAxis,
  markerEnabled,
  markerSize,
  minorSplitLine,
  opacity,
  rowLimit,
  seriesType,
  stack,
  tooltipTimeFormat,
  truncateYAxis,
  yAxisBounds,
  zoomable,
  xAxisLabelRotation,
} = DEFAULT_FORM_DATA;
const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyTimeseriesTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['metrics'],
        ['groupby'],
        [
          {
            name: 'contributionMode',
            config: {
              type: 'SelectControl',
              label: t('Contribution Mode'),
              default: contributionMode,
              choices: [
                [null, 'None'],
                [EchartsTimeseriesContributionType.Row, 'Total'],
                [EchartsTimeseriesContributionType.Column, 'Series'],
              ],
              description: t('Calculate contribution per series or total'),
            },
          },
        ],
        ['adhoc_filters'],
        ['limit'],
        ['timeseries_limit_metric'],
        [
          {
            name: 'order_desc',
            config: {
              type: 'CheckboxControl',
              label: t('Sort Descending'),
              default: true,
              description: t('Whether to sort descending or ascending'),
            },
          },
        ],
        ['row_limit'],
      ],
    },
    {
      label: t('Annotations and Layers'),
      expanded: false,
      controlSetRows: [
        [
          {
            name: 'annotation_layers',
            config: {
              type: 'AnnotationLayerControl',
              label: '',
              default: annotationLayers,
              description: 'Annotation Layers',
            },
          },
        ],
      ],
    },
    {
      label: t('Predictive Analytics'),
      expanded: false,
      controlSetRows: [
        [
          {
            name: 'forecastEnabled',
            config: {
              type: 'CheckboxControl',
              label: t('Enable forecast'),
              renderTrigger: false,
              default: forecastEnabled,
              description: t('Enable forecasting'),
            },
          },
        ],
        [
          {
            name: 'forecastPeriods',
            config: {
              type: 'TextControl',
              label: t('Forecast periods'),
              validators: [legacyValidateInteger],
              default: forecastPeriods,
              description: t('How many periods into the future do we want to predict'),
            },
          },
        ],
        [
          {
            name: 'forecastInterval',
            config: {
              type: 'TextControl',
              label: t('Confidence interval'),
              validators: [legacyValidateNumber],
              default: forecastInterval,
              description: t('Width of the confidence interval. Should be between 0 and 1'),
            },
          },
          {
            name: 'forecastSeasonalityYearly',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: 'Yearly seasonality',
              choices: [
                [null, 'default'],
                [true, 'Yes'],
                [false, 'No'],
              ],
              default: forecastSeasonalityYearly,
              description: t(
                'Should yearly seasonality be applied. An integer value will specify Fourier order of seasonality.',
              ),
            },
          },
        ],
        [
          {
            name: 'forecastSeasonalityWeekly',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: 'Weekly seasonality',
              choices: [
                [null, 'default'],
                [true, 'Yes'],
                [false, 'No'],
              ],
              default: forecastSeasonalityWeekly,
              description: t(
                'Should weekly seasonality be applied. An integer value will specify Fourier order of seasonality.',
              ),
            },
          },
          {
            name: 'forecastSeasonalityDaily',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: 'Daily seasonality',
              choices: [
                [null, 'default'],
                [true, 'Yes'],
                [false, 'No'],
              ],
              default: forecastSeasonalityDaily,
              description: t(
                'Should daily seasonality be applied. An integer value will specify Fourier order of seasonality.',
              ),
            },
          },
        ],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme', 'label_colors'],
        [
          {
            name: 'seriesType',
            config: {
              type: 'SelectControl',
              label: t('Series Style'),
              renderTrigger: true,
              default: seriesType,
              choices: [
                [EchartsTimeseriesSeriesType.Line, 'Line'],
                [EchartsTimeseriesSeriesType.Scatter, 'Scatter'],
                [EchartsTimeseriesSeriesType.Smooth, 'Smooth Line'],
                [EchartsTimeseriesSeriesType.Bar, 'Bar'],
                [EchartsTimeseriesSeriesType.Start, 'Step - start'],
                [EchartsTimeseriesSeriesType.Middle, 'Step - middle'],
                [EchartsTimeseriesSeriesType.End, 'Step - end'],
              ],
              description: t('Series chart type (line, bar etc)'),
            },
          },
        ],
        [
          {
            name: 'stack',
            config: {
              type: 'CheckboxControl',
              label: t('Stack series'),
              renderTrigger: true,
              default: stack,
              description: t('Stack series on top of each other'),
            },
          },
        ],
        [
          {
            name: 'area',
            config: {
              type: 'CheckboxControl',
              label: t('Area Chart'),
              renderTrigger: true,
              default: area,
              description: t('Draw area under curves. Only applicable for line types.'),
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
              description: t('Opacity of Area Chart. Also applies to confidence band.'),
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                Boolean(controls?.area?.value),
            },
          },
        ],
        [
          {
            name: 'markerEnabled',
            config: {
              type: 'CheckboxControl',
              label: t('Marker'),
              renderTrigger: true,
              default: markerEnabled,
              description: t('Draw a marker on data points. Only applicable for line types.'),
            },
          },
        ],
        [
          {
            name: 'markerSize',
            config: {
              type: 'SliderControl',
              label: t('Marker Size'),
              renderTrigger: true,
              min: 0,
              max: 100,
              default: markerSize,
              description: t('Size of marker. Also applies to forecast observations.'),
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                Boolean(controls?.markerEnabled?.value),
            },
          },
        ],
        [
          {
            name: 'zoomable',
            config: {
              type: 'CheckboxControl',
              label: t('Data Zoom'),
              default: zoomable,
              renderTrigger: true,
              description: t('Enable data zooming controls'),
            },
          },
        ],
        isFeatureEnabled(FeatureFlag.DASHBOARD_CROSS_FILTERS)
          ? [
              {
                name: 'emit_filter',
                config: {
                  type: 'CheckboxControl',
                  label: t('Enable emitting filters'),
                  default: emitFilter,
                  renderTrigger: true,
                  description: t('Enable emmiting filters.'),
                },
              },
            ]
          : [],
        ...legendSection,
        [<h1 className="section-header">{t('X Axis')}</h1>],
        [
          {
            name: 'x_axis_time_format',
            config: {
              ...sharedControls.x_axis_time_format,
              default: 'smart_date',
              description: `${D3_TIME_FORMAT_DOCS}. ${t(
                'When using other than adaptive formatting, labels may overlap.',
              )}`,
            },
          },
        ],
        [
          {
            name: 'xAxisLabelRotation',
            config: {
              type: 'SelectControl',
              freeForm: true,
              clearable: false,
              label: t('Rotate x axis label'),
              choices: [
                [0, '0°'],
                [45, '45°'],
              ],
              default: xAxisLabelRotation,
              renderTrigger: true,
              description: t('Input field supports custom rotation. e.g. 30 for 30°'),
            },
          },
        ],
        // eslint-disable-next-line react/jsx-key
        [<h1 className="section-header">{t('Tooltip')}</h1>],
        [
          {
            name: 'rich_tooltip',
            config: {
              type: 'CheckboxControl',
              label: t('Rich tooltip'),
              renderTrigger: true,
              default: true,
              description: t('Shows a list of all series available at that point in time'),
            },
          },
        ],
        [
          {
            name: 'tooltipTimeFormat',
            config: {
              ...sharedControls.x_axis_time_format,
              label: t('Tooltip time format'),
              default: tooltipTimeFormat,
              clearable: false,
            },
          },
        ],
        // eslint-disable-next-line react/jsx-key
        [<h1 className="section-header">{t('Y Axis')}</h1>],
        ['y_axis_format'],
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
        [
          {
            name: 'yAxisTitle',
            config: {
              type: 'TextControl',
              label: t('Primary y-axis title'),
              renderTrigger: true,
              default: '',
              description: t('Title for y-axis'),
            },
          },
        ],
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
  ],
  controlOverrides: {
    row_limit: {
      default: rowLimit,
    },
  },
};

export default config;

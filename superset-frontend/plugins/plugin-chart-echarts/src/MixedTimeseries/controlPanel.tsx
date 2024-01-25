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
import { ensureIsArray, hasGenericChartAxes, t } from '@superset-ui/core';
import { cloneDeep } from 'lodash';
import {
  ControlPanelConfig,
  ControlPanelSectionConfig,
  ControlSetRow,
  ControlSubSectionHeader,
  CustomControlItem,
  getStandardizedControls,
  sections,
  sharedControls,
} from '@superset-ui/chart-controls';

import { DEFAULT_FORM_DATA } from './types';
import { EchartsTimeseriesSeriesType } from '../Timeseries/types';
import {
  legendSection,
  minorTicks,
  richTooltipSection,
  truncateXAxis,
  xAxisBounds,
  xAxisLabelRotation,
} from '../controls';

const {
  area,
  logAxis,
  markerEnabled,
  markerSize,
  minorSplitLine,
  opacity,
  orderDesc,
  rowLimit,
  seriesType,
  showValues,
  stack,
  truncateYAxis,
  yAxisBounds,
  zoomable,
  yAxisIndex,
} = DEFAULT_FORM_DATA;

function createQuerySection(
  label: string,
  controlSuffix: string,
): ControlPanelSectionConfig {
  return {
    label,
    expanded: true,
    controlSetRows: [
      [
        {
          name: `metrics${controlSuffix}`,
          config: sharedControls.metrics,
        },
      ],
      [
        {
          name: `groupby${controlSuffix}`,
          config: sharedControls.groupby,
        },
      ],
      [
        {
          name: `adhoc_filters${controlSuffix}`,
          config: sharedControls.adhoc_filters,
        },
      ],
      [
        {
          name: `limit${controlSuffix}`,
          config: sharedControls.limit,
        },
      ],
      [
        {
          name: `timeseries_limit_metric${controlSuffix}`,
          config: sharedControls.timeseries_limit_metric,
        },
      ],
      [
        {
          name: `order_desc${controlSuffix}`,
          config: {
            type: 'CheckboxControl',
            label: t('Sort Descending'),
            default: orderDesc,
            description: t('Whether to sort descending or ascending'),
          },
        },
      ],
      [
        {
          name: `row_limit${controlSuffix}`,
          config: {
            ...sharedControls.row_limit,
            default: rowLimit,
          },
        },
      ],
      [
        {
          name: `truncate_metric${controlSuffix}`,
          config: {
            ...sharedControls.truncate_metric,
            default: sharedControls.truncate_metric.default,
          },
        },
      ],
    ],
  };
}

function createCustomizeSection(
  label: string,
  controlSuffix: string,
): ControlSetRow[] {
  return [
    [<ControlSubSectionHeader>{label}</ControlSubSectionHeader>],
    [
      {
        name: `seriesType${controlSuffix}`,
        config: {
          type: 'SelectControl',
          label: t('Series type'),
          renderTrigger: true,
          default: seriesType,
          choices: [
            [EchartsTimeseriesSeriesType.Line, t('Line')],
            [EchartsTimeseriesSeriesType.Scatter, t('Scatter')],
            [EchartsTimeseriesSeriesType.Smooth, t('Smooth Line')],
            [EchartsTimeseriesSeriesType.Bar, t('Bar')],
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
        name: `stack${controlSuffix}`,
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
        name: `area${controlSuffix}`,
        config: {
          type: 'CheckboxControl',
          label: t('Area chart'),
          renderTrigger: true,
          default: area,
          description: t(
            'Draw area under curves. Only applicable for line types.',
          ),
        },
      },
    ],
    [
      {
        name: `show_value${controlSuffix}`,
        config: {
          type: 'CheckboxControl',
          label: t('Show Values'),
          renderTrigger: true,
          default: showValues,
          description: t(
            'Whether to display the numerical values within the cells',
          ),
        },
      },
    ],
    [
      {
        name: `opacity${controlSuffix}`,
        config: {
          type: 'SliderControl',
          label: t('Opacity'),
          renderTrigger: true,
          min: 0,
          max: 1,
          step: 0.1,
          default: opacity,
          description: t('Opacity of area chart.'),
        },
      },
    ],
    [
      {
        name: `markerEnabled${controlSuffix}`,
        config: {
          type: 'CheckboxControl',
          label: t('Marker'),
          renderTrigger: true,
          default: markerEnabled,
          description: t(
            'Draw a marker on data points. Only applicable for line types.',
          ),
        },
      },
    ],
    [
      {
        name: `markerSize${controlSuffix}`,
        config: {
          type: 'SliderControl',
          label: t('Marker size'),
          renderTrigger: true,
          min: 0,
          max: 100,
          default: markerSize,
          description: t(
            'Size of marker. Also applies to forecast observations.',
          ),
        },
      },
    ],
    [
      {
        name: `yAxisIndex${controlSuffix}`,
        config: {
          type: 'SelectControl',
          label: t('Y Axis'),
          choices: [
            [0, t('Primary')],
            [1, t('Secondary')],
          ],
          default: yAxisIndex,
          clearable: false,
          renderTrigger: true,
          description: t('Primary or secondary y-axis'),
        },
      },
    ],
  ];
}

function createAdvancedAnalyticsSection(
  label: string,
  controlSuffix: string,
): ControlPanelSectionConfig {
  const aaWithSuffix = cloneDeep(sections.advancedAnalyticsControls);
  aaWithSuffix.label = label;
  if (!controlSuffix) {
    return aaWithSuffix;
  }
  aaWithSuffix.controlSetRows.forEach(row =>
    row.forEach((control: CustomControlItem) => {
      if (control?.name) {
        // eslint-disable-next-line no-param-reassign
        control.name = `${control.name}${controlSuffix}`;
      }
    }),
  );
  return aaWithSuffix;
}

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.genericTime,
    hasGenericChartAxes
      ? {
          label: t('Shared query fields'),
          expanded: true,
          controlSetRows: [['x_axis'], ['time_grain_sqla']],
        }
      : null,
    createQuerySection(t('Query A'), ''),
    createAdvancedAnalyticsSection(t('Advanced analytics Query A'), ''),
    createQuerySection(t('Query B'), '_b'),
    createAdvancedAnalyticsSection(t('Advanced analytics Query B'), '_b'),
    sections.annotationsAndLayersControls,
    sections.titleControls,
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme'],
        ...createCustomizeSection(t('Query A'), ''),
        ...createCustomizeSection(t('Query B'), 'B'),
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
        [minorTicks],
        ...legendSection,
        [<ControlSubSectionHeader>{t('X Axis')}</ControlSubSectionHeader>],
        ['x_axis_time_format'],
        [xAxisLabelRotation],
        ...richTooltipSection,
        // eslint-disable-next-line react/jsx-key
        [<ControlSubSectionHeader>{t('Y Axis')}</ControlSubSectionHeader>],
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
              label: t('Primary y-axis Bounds'),
              renderTrigger: true,
              default: yAxisBounds,
              description: t(
                'Bounds for the primary Y-axis. When left empty, the bounds are ' +
                  'dynamically defined based on the min/max of the data. Note that ' +
                  "this feature will only expand the axis range. It won't " +
                  "narrow the data's extent.",
              ),
            },
          },
        ],
        [
          {
            name: `y_axis_format`,
            config: {
              ...sharedControls.y_axis_format,
              label: t('Primary y-axis format'),
            },
          },
        ],
        ['currency_format'],
        [
          {
            name: 'logAxis',
            config: {
              type: 'CheckboxControl',
              label: t('Logarithmic y-axis'),
              renderTrigger: true,
              default: logAxis,
              description: t('Logarithmic scale on primary y-axis'),
            },
          },
        ],
        [
          {
            name: 'y_axis_bounds_secondary',
            config: {
              type: 'BoundsControl',
              label: t('Secondary y-axis Bounds'),
              renderTrigger: true,
              default: yAxisBounds,
              description: t(
                `Bounds for the secondary Y-axis. Only works when Independent Y-axis
                bounds are enabled. When left empty, the bounds are dynamically defined
                based on the min/max of the data. Note that this feature will only expand
                the axis range. It won't narrow the data's extent.`,
              ),
            },
          },
        ],
        [
          {
            name: `y_axis_format_secondary`,
            config: {
              ...sharedControls.y_axis_format,
              label: t('Secondary y-axis format'),
            },
          },
        ],
        [
          {
            name: 'currency_format_secondary',
            config: {
              ...sharedControls.currency_format,
              label: t('Secondary currency format'),
            },
          },
        ],
        [
          {
            name: 'yAxisTitleSecondary',
            config: {
              type: 'TextControl',
              label: t('Secondary y-axis title'),
              renderTrigger: true,
              default: '',
              description: t('Logarithmic y-axis'),
            },
          },
        ],
        [
          {
            name: 'logAxisSecondary',
            config: {
              type: 'CheckboxControl',
              label: t('Logarithmic y-axis'),
              renderTrigger: true,
              default: logAxis,
              description: t('Logarithmic scale on secondary y-axis'),
            },
          },
        ],
      ],
    },
  ],
  formDataOverrides: formData => {
    const groupby = getStandardizedControls().controls.columns.filter(
      col => !ensureIsArray(formData.groupby_b).includes(col),
    );
    getStandardizedControls().controls.columns =
      getStandardizedControls().controls.columns.filter(
        col => !groupby.includes(col),
      );

    const metrics = getStandardizedControls().controls.metrics.filter(
      metric => !ensureIsArray(formData.metrics_b).includes(metric),
    );
    getStandardizedControls().controls.metrics =
      getStandardizedControls().controls.metrics.filter(
        col => !metrics.includes(col),
      );

    return {
      ...formData,
      metrics,
      groupby,
    };
  },
};

export default config;

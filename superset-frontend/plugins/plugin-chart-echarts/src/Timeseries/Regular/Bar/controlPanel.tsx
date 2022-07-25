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
import { FeatureFlag, isFeatureEnabled, t } from '@superset-ui/core';
import {
  ControlPanelConfig,
  ControlPanelsContainerProps,
  ControlSetRow,
  ControlStateMapping,
  D3_TIME_FORMAT_DOCS,
  emitFilterControl,
  formatSelectOptions,
  sections,
  sharedControls,
} from '@superset-ui/chart-controls';

import {
  DEFAULT_FORM_DATA,
  EchartsTimeseriesContributionType,
  OrientationType,
} from '../../types';
import {
  legendSection,
  richTooltipSection,
  showValueSection,
  xAxisControl,
} from '../../../controls';

const {
  contributionMode,
  logAxis,
  minorSplitLine,
  rowLimit,
  truncateYAxis,
  yAxisBounds,
  zoomable,
  xAxisLabelRotation,
  orientation,
} = DEFAULT_FORM_DATA;

function createAxisTitleControl(axis: 'x' | 'y'): ControlSetRow[] {
  const isXAxis = axis === 'x';
  const isVertical = (controls: ControlStateMapping) =>
    Boolean(controls?.orientation.value === OrientationType.vertical);
  const isHorizental = (controls: ControlStateMapping) =>
    Boolean(controls?.orientation.value === OrientationType.horizontal);
  return [
    [
      {
        name: 'x_axis_title',
        config: {
          type: 'TextControl',
          label: t('Axis Title'),
          renderTrigger: true,
          default: '',
          description: t('Changing this control takes effect instantly'),
          visibility: ({ controls }: ControlPanelsContainerProps) =>
            isXAxis ? isVertical(controls) : isHorizental(controls),
        },
      },
    ],
    [
      {
        name: 'x_axis_title_margin',
        config: {
          type: 'SelectControl',
          freeForm: true,
          clearable: true,
          label: t('AXIS TITLE MARGIN'),
          renderTrigger: true,
          default: sections.TITLE_MARGIN_OPTIONS[0],
          choices: formatSelectOptions(sections.TITLE_MARGIN_OPTIONS),
          description: t('Changing this control takes effect instantly'),
          visibility: ({ controls }: ControlPanelsContainerProps) =>
            isXAxis ? isVertical(controls) : isHorizental(controls),
        },
      },
    ],
    [
      {
        name: 'y_axis_title',
        config: {
          type: 'TextControl',
          label: t('Axis Title'),
          renderTrigger: true,
          default: '',
          description: t('Changing this control takes effect instantly'),
          visibility: ({ controls }: ControlPanelsContainerProps) =>
            isXAxis ? isHorizental(controls) : isVertical(controls),
        },
      },
    ],
    [
      {
        name: 'y_axis_title_margin',
        config: {
          type: 'SelectControl',
          freeForm: true,
          clearable: true,
          label: t('AXIS TITLE MARGIN'),
          renderTrigger: true,
          default: sections.TITLE_MARGIN_OPTIONS[0],
          choices: formatSelectOptions(sections.TITLE_MARGIN_OPTIONS),
          description: t('Changing this control takes effect instantly'),
          visibility: ({ controls }: ControlPanelsContainerProps) =>
            isXAxis ? isHorizental(controls) : isVertical(controls),
        },
      },
    ],
    [
      {
        name: 'y_axis_title_position',
        config: {
          type: 'SelectControl',
          freeForm: true,
          clearable: false,
          label: t('AXIS TITLE POSITION'),
          renderTrigger: true,
          default: sections.TITLE_POSITION_OPTIONS[0],
          choices: formatSelectOptions(sections.TITLE_POSITION_OPTIONS),
          description: t('Changing this control takes effect instantly'),
          visibility: ({ controls }: ControlPanelsContainerProps) =>
            isXAxis ? isHorizental(controls) : isVertical(controls),
        },
      },
    ],
  ];
}

function createAxisControl(axis: 'x' | 'y'): ControlSetRow[] {
  const isXAxis = axis === 'x';
  const isVertical = (controls: ControlStateMapping) =>
    Boolean(controls?.orientation.value === OrientationType.vertical);
  const isHorizental = (controls: ControlStateMapping) =>
    Boolean(controls?.orientation.value === OrientationType.horizontal);
  return [
    [
      {
        name: 'x_axis_time_format',
        config: {
          ...sharedControls.x_axis_time_format,
          default: 'smart_date',
          description: `${D3_TIME_FORMAT_DOCS}. ${t(
            'When using other than adaptive formatting, labels may overlap.',
          )}`,
          visibility: ({ controls }: ControlPanelsContainerProps) =>
            isXAxis ? isVertical(controls) : isHorizental(controls),
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
          label: t('Rotate axis label'),
          choices: [
            [0, '0°'],
            [45, '45°'],
          ],
          default: xAxisLabelRotation,
          renderTrigger: true,
          description: t(
            'Input field supports custom rotation. e.g. 30 for 30°',
          ),
          visibility: ({ controls }: ControlPanelsContainerProps) =>
            isXAxis ? isVertical(controls) : isHorizental(controls),
        },
      },
    ],
    [
      {
        name: 'y_axis_format',
        config: {
          ...sharedControls.y_axis_format,
          label: t('Axis Format'),
          visibility: ({ controls }: ControlPanelsContainerProps) =>
            isXAxis ? isHorizental(controls) : isVertical(controls),
        },
      },
    ],
    [
      {
        name: 'logAxis',
        config: {
          type: 'CheckboxControl',
          label: t('Logarithmic axis'),
          renderTrigger: true,
          default: logAxis,
          description: t('Logarithmic axis'),
          visibility: ({ controls }: ControlPanelsContainerProps) =>
            isXAxis ? isHorizental(controls) : isVertical(controls),
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
          description: t('Draw split lines for minor axis ticks'),
          visibility: ({ controls }: ControlPanelsContainerProps) =>
            isXAxis ? isHorizental(controls) : isVertical(controls),
        },
      },
    ],
    [
      {
        name: 'truncateYAxis',
        config: {
          type: 'CheckboxControl',
          label: t('Truncate Axis'),
          default: truncateYAxis,
          renderTrigger: true,
          description: t('It’s not recommended to truncate axis in Bar chart.'),
          visibility: ({ controls }: ControlPanelsContainerProps) =>
            isXAxis ? isHorizental(controls) : isVertical(controls),
        },
      },
    ],
    [
      {
        name: 'y_axis_bounds',
        config: {
          type: 'BoundsControl',
          label: t('Axis Bounds'),
          renderTrigger: true,
          default: yAxisBounds,
          description: t(
            'Bounds for the axis. When left empty, the bounds are ' +
              'dynamically defined based on the min/max of the data. Note that ' +
              "this feature will only expand the axis range. It won't " +
              "narrow the data's extent.",
          ),
          visibility: ({ controls }: ControlPanelsContainerProps) =>
            Boolean(controls?.truncateYAxis?.value) &&
            (isXAxis ? isHorizental(controls) : isVertical(controls)),
        },
      },
    ],
  ];
}

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyTimeseriesTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        isFeatureEnabled(FeatureFlag.GENERIC_CHART_AXES) ? [xAxisControl] : [],
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
                [EchartsTimeseriesContributionType.Row, 'Row'],
                [EchartsTimeseriesContributionType.Column, 'Series'],
              ],
              description: t('Calculate contribution per series or row'),
            },
          },
        ],
        ['adhoc_filters'],
        emitFilterControl,
        ['limit'],
        ['timeseries_limit_metric'],
        ['order_desc'],
        ['row_limit'],
        ['truncate_metric'],
      ],
    },
    sections.advancedAnalyticsControls,
    sections.annotationsAndLayersControls,
    sections.forecastIntervalControls,
    {
      label: t('Chart Orientation'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'orientation',
            config: {
              type: 'RadioButtonControl',
              renderTrigger: true,
              label: t('Bar orientation'),
              default: orientation,
              options: [
                [OrientationType.vertical, t('Vertical')],
                [OrientationType.horizontal, t('Horizontal')],
              ],
              description: t('Orientation of bar chart'),
            },
          },
        ],
      ],
    },
    {
      label: t('Chart Title'),
      tabOverride: 'customize',
      expanded: true,
      controlSetRows: [
        [<div className="section-header">{t('X Axis')}</div>],
        ...createAxisTitleControl('x'),
        [<div className="section-header">{t('Y Axis')}</div>],
        ...createAxisTitleControl('y'),
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme'],
        ...showValueSection,
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
        ...legendSection,
        [<div className="section-header">{t('X Axis')}</div>],
        ...createAxisControl('x'),
        ...richTooltipSection,
        [<div className="section-header">{t('Y Axis')}</div>],
        ...createAxisControl('y'),
      ],
    },
  ],
  controlOverrides: {
    row_limit: {
      default: rowLimit,
    },
  },
  denormalizeFormData: formData => ({
    ...formData,
    metrics: formData.standardizedFormData.standardizedState.metrics,
    groupby: formData.standardizedFormData.standardizedState.columns,
  }),
};

export default config;

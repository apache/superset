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
import { t } from '@superset-ui/core';
import {
  ControlPanelConfig,
  ControlPanelsContainerProps,
  ControlSetRow,
  ControlStateMapping,
  ControlSubSectionHeader,
  D3_TIME_FORMAT_DOCS,
  formatSelectOptions,
  getStandardizedControls,
  sections,
  sharedControls,
} from '@superset-ui/chart-controls';
import {
  legendSection,
  minorTicks,
  richTooltipSection,
  seriesOrderSection,
  showValueSection,
  truncateXAxis,
  xAxisBounds,
  xAxisLabelRotation,
} from '../../../controls';

import { OrientationType } from '../../types';
import {
  DEFAULT_FORM_DATA,
  TIME_SERIES_DESCRIPTION_TEXT,
} from '../../constants';

const {
  logAxis,
  minorSplitLine,
  truncateYAxis,
  yAxisBounds,
  zoomable,
  orientation,
} = DEFAULT_FORM_DATA;

function createAxisTitleControl(axis: 'x' | 'y'): ControlSetRow[] {
  const isXAxis = axis === 'x';
  const isVertical = (controls: ControlStateMapping) =>
    Boolean(controls?.orientation.value === OrientationType.Vertical);
  const isHorizontal = (controls: ControlStateMapping) =>
    Boolean(controls?.orientation.value === OrientationType.Horizontal);
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
            isXAxis ? isVertical(controls) : isHorizontal(controls),
          disableStash: true,
          resetOnHide: false,
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
            isXAxis ? isVertical(controls) : isHorizontal(controls),
          disableStash: true,
          resetOnHide: false,
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
            isXAxis ? isHorizontal(controls) : isVertical(controls),
          disableStash: true,
          resetOnHide: false,
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
            isXAxis ? isHorizontal(controls) : isVertical(controls),
          disableStash: true,
          resetOnHide: false,
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
          default: sections.TITLE_POSITION_OPTIONS[0][0],
          choices: sections.TITLE_POSITION_OPTIONS,
          description: t('Changing this control takes effect instantly'),
          visibility: ({ controls }: ControlPanelsContainerProps) =>
            isXAxis ? isHorizontal(controls) : isVertical(controls),
          disableStash: true,
          resetOnHide: false,
        },
      },
    ],
  ];
}

function createAxisControl(axis: 'x' | 'y'): ControlSetRow[] {
  const isXAxis = axis === 'x';
  const isVertical = (controls: ControlStateMapping) =>
    Boolean(controls?.orientation.value === OrientationType.Vertical);
  const isHorizontal = (controls: ControlStateMapping) =>
    Boolean(controls?.orientation.value === OrientationType.Horizontal);
  return [
    [
      {
        name: 'x_axis_time_format',
        config: {
          ...sharedControls.x_axis_time_format,
          default: 'smart_date',
          description: `${D3_TIME_FORMAT_DOCS}. ${TIME_SERIES_DESCRIPTION_TEXT}`,
          visibility: ({ controls }: ControlPanelsContainerProps) =>
            isXAxis ? isVertical(controls) : isHorizontal(controls),
          disableStash: true,
          resetOnHide: false,
        },
      },
    ],
    [
      {
        name: xAxisLabelRotation.name,
        config: {
          ...xAxisLabelRotation.config,
          visibility: ({ controls }: ControlPanelsContainerProps) =>
            isXAxis ? isVertical(controls) : isHorizontal(controls),
          disableStash: true,
          resetOnHide: false,
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
            isXAxis ? isHorizontal(controls) : isVertical(controls),
          disableStash: true,
          resetOnHide: false,
        },
      },
    ],
    ['currency_format'],
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
            isXAxis ? isHorizontal(controls) : isVertical(controls),
          disableStash: true,
          resetOnHide: false,
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
            isXAxis ? isHorizontal(controls) : isVertical(controls),
          disableStash: true,
          resetOnHide: false,
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
            isXAxis ? isHorizontal(controls) : isVertical(controls),
          disableStash: true,
          resetOnHide: false,
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
            (isXAxis ? isHorizontal(controls) : isVertical(controls)),
          disableStash: true,
          resetOnHide: false,
        },
      },
    ],
  ];
}

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.echartsTimeSeriesQueryWithXAxisSort,
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
                [OrientationType.Vertical, t('Vertical')],
                [OrientationType.Horizontal, t('Horizontal')],
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
        [<ControlSubSectionHeader>{t('X Axis')}</ControlSubSectionHeader>],
        ...createAxisTitleControl('x'),
        [<ControlSubSectionHeader>{t('Y Axis')}</ControlSubSectionHeader>],
        ...createAxisTitleControl('y'),
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ...seriesOrderSection,
        ['color_scheme'],
        ['time_shift_color'],
        ...showValueSection,
        [minorTicks],
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
        [<ControlSubSectionHeader>{t('X Axis')}</ControlSubSectionHeader>],
        ...createAxisControl('x'),
        [truncateXAxis],
        [xAxisBounds],
        ...richTooltipSection,
        [<ControlSubSectionHeader>{t('Y Axis')}</ControlSubSectionHeader>],
        ...createAxisControl('y'),
      ],
    },
  ],
  formDataOverrides: formData => ({
    ...formData,
    metrics: getStandardizedControls().popAllMetrics(),
    groupby: getStandardizedControls().popAllColumns(),
  }),
};

export default config;

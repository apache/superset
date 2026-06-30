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
import { t } from '@apache-superset/core/translation';
import { getColumnLabel, QueryFormColumn } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import {
  checkColumnType,
  ControlPanelConfig,
  ControlPanelSectionConfig,
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

import { OrientationType } from '../../types';
import {
  DEFAULT_FORM_DATA,
  TIME_SERIES_DESCRIPTION_TEXT,
} from '../../constants';
import {
  legendSection,
  minorTicks,
  richTooltipSection,
  seriesOrderSection,
  showValueSection,
  truncateXAxis,
  xAxisBounds,
  xAxisLabelRotation,
  xAxisLabelInterval,
  forceMaxInterval,
} from '../../../controls';

const {
  logAxis,
  markerEnabled,
  markerSize,
  maxMarkerSize,
  minMarkerSize,
  minorSplitLine,
  orientation,
  rowLimit,
  truncateYAxis,
  yAxisBounds,
} = DEFAULT_FORM_DATA;

const isHorizontal = (controls: ControlStateMapping) =>
  controls?.orientation?.value === OrientationType.Horizontal;
const isVertical = (controls: ControlStateMapping) => !isHorizontal(controls);

function createAxisTitleControl(axis: 'x' | 'y'): ControlSetRow[] {
  const isXAxis = axis === 'x';
  return [
    [
      {
        name: 'x_axis_title',
        config: {
          type: 'TextControl',
          label: t('Axis Title'),
          renderTrigger: true,
          default: '',
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
          label: t('Axis title margin'),
          renderTrigger: true,
          default: sections.TITLE_MARGIN_OPTIONS[3],
          choices: formatSelectOptions(sections.TITLE_MARGIN_OPTIONS),
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
          label: t('Axis title margin'),
          renderTrigger: true,
          default: sections.TITLE_MARGIN_OPTIONS[4],
          choices: formatSelectOptions(sections.TITLE_MARGIN_OPTIONS),
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
          label: t('Axis title position'),
          renderTrigger: true,
          default: sections.TITLE_POSITION_OPTIONS[0][0],
          choices: sections.TITLE_POSITION_OPTIONS,
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
  // The dimension (x_axis) controls follow the dimension axis: they show
  // under "X Axis" when vertical and under "Y Axis" when horizontal. The
  // metric controls follow the opposite axis.
  const showsDimensionAxis = (controls: ControlStateMapping) =>
    isXAxis ? isVertical(controls) : isHorizontal(controls);
  const showsMetricAxis = (controls: ControlStateMapping) =>
    isXAxis ? isHorizontal(controls) : isVertical(controls);
  return [
    [
      {
        name: 'x_axis_time_format',
        config: {
          ...sharedControls.x_axis_time_format,
          default: 'smart_date',
          description: `${D3_TIME_FORMAT_DOCS}. ${TIME_SERIES_DESCRIPTION_TEXT}`,
          visibility: ({ controls }: ControlPanelsContainerProps) =>
            showsDimensionAxis(controls) &&
            checkColumnType(
              getColumnLabel(controls?.x_axis?.value as QueryFormColumn),
              controls?.datasource?.datasource,
              [GenericDataType.Temporal],
            ),
          disableStash: true,
          resetOnHide: false,
        },
      },
    ],
    [
      {
        name: 'x_axis_number_format',
        config: {
          ...sharedControls.x_axis_number_format,
          default: '~g',
          mapStateToProps: undefined,
          visibility: ({ controls }: ControlPanelsContainerProps) =>
            showsDimensionAxis(controls) &&
            checkColumnType(
              getColumnLabel(controls?.x_axis?.value as QueryFormColumn),
              controls?.datasource?.datasource,
              [GenericDataType.Numeric],
            ),
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
            showsDimensionAxis(controls),
          disableStash: true,
          resetOnHide: false,
        },
      },
    ],
    [
      {
        name: xAxisLabelInterval.name,
        config: {
          ...xAxisLabelInterval.config,
          visibility: ({ controls }: ControlPanelsContainerProps) =>
            showsDimensionAxis(controls),
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
            showsMetricAxis(controls),
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
            showsMetricAxis(controls),
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
            showsMetricAxis(controls),
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
          description: t(
            'Truncate the metric axis. Can be overridden by specifying a min or max bound.',
          ),
          visibility: ({ controls }: ControlPanelsContainerProps) =>
            showsMetricAxis(controls),
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
            showsMetricAxis(controls),
          disableStash: true,
          resetOnHide: false,
        },
      },
    ],
  ];
}

const sizeMetricRow: ControlSetRow = [
  {
    name: 'size',
    config: {
      ...sharedControls.size,
      label: t('Dot size metric'),
      description: t(
        'Optional metric used to scale the size of each dot. Dot areas are ' +
          'scaled linearly between the minimum and maximum dot size.',
      ),
      validators: [],
    },
  },
];

const queryRows: ControlSetRow[] = [
  ...sections.echartsTimeSeriesQueryWithXAxisSort.controlSetRows,
];
const groupbyRowIndex = queryRows.findIndex(
  row => row.length === 1 && row[0] === 'groupby',
);
queryRows.splice(
  groupbyRowIndex === -1 ? queryRows.length : groupbyRowIndex + 1,
  0,
  sizeMetricRow,
);
const querySection: ControlPanelSectionConfig = {
  ...sections.echartsTimeSeriesQueryWithXAxisSort,
  controlSetRows: queryRows,
};

const config: ControlPanelConfig = {
  controlPanelSections: [
    querySection,
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
              label: t('Chart orientation'),
              default: orientation,
              options: [
                [OrientationType.Vertical, t('Vertical')],
                [OrientationType.Horizontal, t('Horizontal')],
              ],
              description: t(
                'Orientation of the chart. Horizontal places the dimension on the y-axis and the metric on the x-axis.',
              ),
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
        [
          {
            name: 'markerEnabled',
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
            name: 'markerSize',
            config: {
              type: 'SliderControl',
              label: t('Marker Size'),
              renderTrigger: true,
              min: 0,
              max: 100,
              default: markerSize,
              description: t(
                'Size of marker. Also applies to forecast observations.',
              ),
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                Boolean(controls?.markerEnabled?.value) &&
                !controls?.size?.value,
            },
          },
        ],
        [
          {
            name: 'minMarkerSize',
            config: {
              type: 'SliderControl',
              label: t('Minimum dot size'),
              renderTrigger: true,
              min: 1,
              max: 100,
              default: minMarkerSize,
              description: t(
                'Size of the dot representing the smallest value of the dot size metric.',
              ),
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                Boolean(controls?.size?.value),
            },
          },
          {
            name: 'maxMarkerSize',
            config: {
              type: 'SliderControl',
              label: t('Maximum dot size'),
              renderTrigger: true,
              min: 1,
              max: 100,
              default: maxMarkerSize,
              description: t(
                'Size of the dot representing the largest value of the dot size metric.',
              ),
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                Boolean(controls?.size?.value),
            },
          },
        ],
        ['zoomable'],
        [minorTicks],
        ...legendSection,
        [<ControlSubSectionHeader>{t('X Axis')}</ControlSubSectionHeader>],
        ...createAxisControl('x'),
        [truncateXAxis],
        [xAxisBounds],
        [forceMaxInterval],
        ...richTooltipSection,
        [<ControlSubSectionHeader>{t('Y Axis')}</ControlSubSectionHeader>],
        ...createAxisControl('y'),
      ],
    },
  ],
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
};

export default config;

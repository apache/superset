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
  ControlPanelsContainerProps,
  ControlSetItem,
  ControlSetRow,
  ControlSubSectionHeader,
  DEFAULT_SORT_SERIES_DATA,
  SORT_SERIES_CHOICES,
  sharedControls,
} from '@superset-ui/chart-controls';
import { DEFAULT_LEGEND_FORM_DATA, StackControlOptions } from './constants';
import { DEFAULT_FORM_DATA } from './Timeseries/constants';
import { defaultXAxis } from './defaults';

const { legendMargin, legendOrientation, legendType, showLegend } =
  DEFAULT_LEGEND_FORM_DATA;

export const showLegendControl: ControlSetItem = {
  name: 'show_legend',
  config: {
    type: 'CheckboxControl',
    label: t('Show legend'),
    renderTrigger: true,
    default: showLegend,
    description: t('Whether to display a legend for the chart'),
  },
};

const legendMarginControl: ControlSetItem = {
  name: 'legendMargin',
  config: {
    type: 'TextControl',
    label: t('Margin'),
    renderTrigger: true,
    isInt: true,
    default: legendMargin,
    description: t('Additional padding for legend.'),
    visibility: ({ controls }: ControlPanelsContainerProps) =>
      Boolean(controls?.show_legend?.value),
  },
};

const legendTypeControl: ControlSetItem = {
  name: 'legendType',
  config: {
    type: 'SelectControl',
    freeForm: false,
    label: t('Type'),
    choices: [
      ['scroll', t('Scroll')],
      ['plain', t('Plain')],
    ],
    default: legendType,
    renderTrigger: true,
    description: t('Legend type'),
    visibility: ({ controls }: ControlPanelsContainerProps) =>
      Boolean(controls?.show_legend?.value),
  },
};

const legendOrientationControl: ControlSetItem = {
  name: 'legendOrientation',
  config: {
    type: 'SelectControl',
    freeForm: false,
    label: t('Orientation'),
    choices: [
      ['top', t('Top')],
      ['bottom', t('Bottom')],
      ['left', t('Left')],
      ['right', t('Right')],
    ],
    default: legendOrientation,
    renderTrigger: true,
    description: t('Legend Orientation'),
    visibility: ({ controls }: ControlPanelsContainerProps) =>
      Boolean(controls?.show_legend?.value),
  },
};

export const legendSection: ControlSetRow[] = [
  [<ControlSubSectionHeader>{t('Legend')}</ControlSubSectionHeader>],
  [showLegendControl],
  [legendTypeControl],
  [legendOrientationControl],
  [legendMarginControl],
];

export const showValueControl: ControlSetItem = {
  name: 'show_value',
  config: {
    type: 'CheckboxControl',
    label: t('Show Value'),
    default: false,
    renderTrigger: true,
    description: t('Show series values on the chart'),
  },
};

export const stackControl: ControlSetItem = {
  name: 'stack',
  config: {
    type: 'SelectControl',
    label: t('Stacked Style'),
    renderTrigger: true,
    choices: StackControlOptions,
    default: null,
    description: t('Stack series on top of each other'),
  },
};

export const onlyTotalControl: ControlSetItem = {
  name: 'only_total',
  config: {
    type: 'CheckboxControl',
    label: t('Only Total'),
    default: true,
    renderTrigger: true,
    description: t(
      'Only show the total value on the stacked chart, and not show on the selected category',
    ),
    visibility: ({ controls }: ControlPanelsContainerProps) =>
      Boolean(controls?.show_value?.value) && Boolean(controls?.stack?.value),
  },
};

export const percentageThresholdControl: ControlSetItem = {
  name: 'percentage_threshold',
  config: {
    type: 'TextControl',
    label: t('Percentage threshold'),
    renderTrigger: true,
    isFloat: true,
    default: DEFAULT_FORM_DATA.percentageThreshold,
    description: t(
      'Minimum threshold in percentage points for showing labels.',
    ),
    visibility: ({ controls }: ControlPanelsContainerProps) =>
      Boolean(controls?.show_value?.value) &&
      Boolean(controls?.stack?.value) &&
      Boolean(!controls?.only_total?.value),
  },
};

export const showValueSection: ControlSetRow[] = [
  [showValueControl],
  [stackControl],
  [onlyTotalControl],
  [percentageThresholdControl],
];

export const showValueSectionWithoutStack: ControlSetRow[] = [
  [showValueControl],
  [onlyTotalControl],
];

const richTooltipControl: ControlSetItem = {
  name: 'rich_tooltip',
  config: {
    type: 'CheckboxControl',
    label: t('Rich tooltip'),
    renderTrigger: true,
    default: true,
    description: t(
      'Shows a list of all series available at that point in time',
    ),
  },
};

const tooltipTimeFormatControl: ControlSetItem = {
  name: 'tooltipTimeFormat',
  config: {
    ...sharedControls.x_axis_time_format,
    label: t('Tooltip time format'),
    default: 'smart_date',
    clearable: false,
  },
};

const tooltipSortByMetricControl: ControlSetItem = {
  name: 'tooltipSortByMetric',
  config: {
    type: 'CheckboxControl',
    label: t('Tooltip sort by metric'),
    renderTrigger: true,
    default: false,
    description: t(
      'Whether to sort tooltip by the selected metric in descending order.',
    ),
    visibility: ({ controls }: ControlPanelsContainerProps) =>
      Boolean(controls?.rich_tooltip?.value),
  },
};

const tooltipTotalControl: ControlSetItem = {
  name: 'showTooltipTotal',
  config: {
    type: 'CheckboxControl',
    label: t('Show total'),
    renderTrigger: true,
    default: true,
    description: t('Whether to display the total value in the tooltip'),
    visibility: ({ controls, form_data }: ControlPanelsContainerProps) =>
      Boolean(controls?.rich_tooltip?.value) &&
      form_data.viz_type !== 'mixed_timeseries',
  },
};

const tooltipPercentageControl: ControlSetItem = {
  name: 'showTooltipPercentage',
  config: {
    type: 'CheckboxControl',
    label: t('Show percentage'),
    renderTrigger: true,
    default: true,
    description: t('Whether to display the percentage value in the tooltip'),
    visibility: ({ controls, form_data }: ControlPanelsContainerProps) =>
      Boolean(controls?.rich_tooltip?.value) &&
      !controls?.contributionMode?.value &&
      form_data.viz_type !== 'mixed_timeseries',
  },
};

export const richTooltipSection: ControlSetRow[] = [
  [<ControlSubSectionHeader>{t('Tooltip')}</ControlSubSectionHeader>],
  [richTooltipControl],
  [tooltipTotalControl],
  [tooltipPercentageControl],
  [tooltipSortByMetricControl],
  [tooltipTimeFormatControl],
];

const sortSeriesType: ControlSetItem = {
  name: 'sort_series_type',
  config: {
    type: 'SelectControl',
    freeForm: false,
    label: t('Sort Series By'),
    choices: SORT_SERIES_CHOICES,
    default: DEFAULT_SORT_SERIES_DATA.sort_series_type,
    renderTrigger: true,
    description: t(
      'Based on what should series be ordered on the chart and legend',
    ),
  },
};

const sortSeriesAscending: ControlSetItem = {
  name: 'sort_series_ascending',
  config: {
    type: 'CheckboxControl',
    label: t('Sort Series Ascending'),
    default: DEFAULT_SORT_SERIES_DATA.sort_series_ascending,
    renderTrigger: true,
    description: t('Sort series in ascending order'),
  },
};

export const xAxisLabelRotation = {
  name: 'xAxisLabelRotation',
  config: {
    type: 'SelectControl',
    freeForm: true,
    clearable: false,
    label: t('Rotate x axis label'),
    choices: [
      [0, '0°'],
      [45, '45°'],
      [90, '90°'],
    ],
    default: defaultXAxis.xAxisLabelRotation,
    renderTrigger: true,
    description: t('Input field supports custom rotation. e.g. 30 for 30°'),
  },
};

export const seriesOrderSection: ControlSetRow[] = [
  [<ControlSubSectionHeader>{t('Series Order')}</ControlSubSectionHeader>],
  [sortSeriesType],
  [sortSeriesAscending],
];

export const truncateXAxis: ControlSetItem = {
  name: 'truncateXAxis',
  config: {
    type: 'CheckboxControl',
    label: t('Truncate X Axis'),
    default: DEFAULT_FORM_DATA.truncateXAxis,
    renderTrigger: true,
    description: t(
      'Truncate X Axis. Can be overridden by specifying a min or max bound. Only applicable for numercal X axis.',
    ),
  },
};

export const xAxisBounds: ControlSetItem = {
  name: 'xAxisBounds',
  config: {
    type: 'BoundsControl',
    label: t('X Axis Bounds'),
    renderTrigger: true,
    default: DEFAULT_FORM_DATA.xAxisBounds,
    description: t(
      'Bounds for numerical X axis. Not applicable for temporal or categorical axes. ' +
        'When left empty, the bounds are dynamically defined based on the min/max of the data. ' +
        "Note that this feature will only expand the axis range. It won't " +
        "narrow the data's extent.",
    ),
    visibility: ({ controls }: ControlPanelsContainerProps) =>
      Boolean(controls?.truncateXAxis?.value),
  },
};

export const minorTicks: ControlSetItem = {
  name: 'minorTicks',
  config: {
    type: 'CheckboxControl',
    label: t('Minor ticks'),
    default: false,
    renderTrigger: true,
    description: t('Show minor ticks on axes.'),
  },
};

export const forceCategorical: ControlSetItem = {
  name: 'forceCategorical',
  config: {
    type: 'CheckboxControl',
    label: t('Force categorical'),
    default: false,
    renderTrigger: true,
    description: t('Make the x-axis categorical'),
  },
};

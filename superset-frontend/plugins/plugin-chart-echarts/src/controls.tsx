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
import { t } from '@superset-ui/core';
import {
  ControlPanelsContainerProps,
  ControlSetItem,
  ControlSetRow,
  sharedControls,
} from '@superset-ui/chart-controls';
import { DEFAULT_LEGEND_FORM_DATA } from './constants';
import { DEFAULT_FORM_DATA } from './Timeseries/constants';

const { legendMargin, legendOrientation, legendType, showLegend } =
  DEFAULT_LEGEND_FORM_DATA;

const showLegendControl: ControlSetItem = {
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
  [<div className="section-header">{t('Legend')}</div>],
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
    type: 'CheckboxControl',
    label: t('Stack series'),
    renderTrigger: true,
    default: false,
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

const percentageThresholdControl: ControlSetItem = {
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

export const richTooltipSection: ControlSetRow[] = [
  [<div className="section-header">{t('Tooltip')}</div>],
  [richTooltipControl],
  [tooltipSortByMetricControl],
  [tooltipTimeFormatControl],
];

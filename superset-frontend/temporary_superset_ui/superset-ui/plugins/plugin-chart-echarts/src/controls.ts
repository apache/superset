import { t } from '@superset-ui/core';
import { DEFAULT_LEGEND_FORM_DATA } from './types';

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
const { legendMargin, legendOrientation, legendType, showLegend } = DEFAULT_LEGEND_FORM_DATA;

export const noopControl = { name: 'noop', config: { type: '', renderTrigger: true } };

export const showLegendControl = {
  name: 'show_legend',
  config: {
    type: 'CheckboxControl',
    label: t('Legend'),
    renderTrigger: true,
    default: showLegend,
    description: t('Whether to display a legend for the chart'),
  },
};

export const legendMarginControl = {
  name: 'legendMargin',
  config: {
    type: 'TextControl',
    label: t('Margin'),
    renderTrigger: true,
    isInt: true,
    default: legendMargin,
    description: t('Additional padding for legend.'),
  },
};

export const legendTypeControl = {
  name: 'legendType',
  config: {
    type: 'SelectControl',
    freeForm: false,
    label: 'Type',
    choices: [
      ['scroll', 'Scroll'],
      ['plain', 'Plain'],
    ],
    default: legendType,
    renderTrigger: true,
    description: t('Legend type'),
  },
};

export const legendOrientationControl = {
  name: 'legendOrientation',
  config: {
    type: 'SelectControl',
    freeForm: false,
    label: 'Orientation',
    choices: [
      ['top', 'Top'],
      ['bottom', 'Bottom'],
      ['left', 'Left'],
      ['right', 'Right'],
    ],
    default: legendOrientation,
    renderTrigger: true,
    description: t('Legend type'),
  },
};

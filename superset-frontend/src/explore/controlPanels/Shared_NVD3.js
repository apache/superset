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

// These are control configurations that are shared ONLY within the DeckGL viz plugin repo.

import React from 'react';
import { t } from '@superset-ui/translation';
import { formatSelectOptions } from '../../modules/utils';
// import ColumnOption from '../../components/ColumnOption';
// import { D3_FORMAT_OPTIONS, columnChoices, PRIMARY_COLOR } from '../controls';
// import { DEFAULT_VIEWPORT } from '../../explore/components/controls/ViewportControl';

// import { nonEmpty } from '../validators';

/*
  AreaChartPlugin,
  BarChartPlugin,
  BubbleChartPlugin,
  BulletChartPlugin,
  CompareChartPlugin,
  DistBarChartPlugin,
  DualLineChartPlugin,
  LineChartPlugin,
  LineMultiChartPlugin,
  PieChartPlugin,
  TimePivotChartPlugin,
*/

export const lineInterpolation = {
  name: 'line_interpolation',
  config: {
    type: 'SelectControl',
    label: t('Line Style'),
    renderTrigger: true,
    choices: formatSelectOptions([
      'linear',
      'basis',
      'cardinal',
      'monotone',
      'step-before',
      'step-after',
    ]),
    default: 'linear',
    description: t('Line interpolation as defined by d3.js'),
  },
};

export const showBrush = {
  name: 'show_brush',
  config: {
    type: 'SelectControl',
    label: t('Show Range Filter'),
    renderTrigger: true,
    clearable: false,
    default: 'auto',
    choices: [
      ['yes', 'Yes'],
      ['no', 'No'],
      ['auto', 'Auto'],
    ],
    description: t('Whether to display the time range interactive selector'),
  },
};

export const showLegend = {
  name: 'show_legend',
  config: {
    type: 'CheckboxControl',
    label: t('Legend'),
    renderTrigger: true,
    default: true,
    description: t('Whether to display the legend (toggles)'),
  },
};

export const showControls = {
  name: 'show_controls',
  config: {
    type: 'CheckboxControl',
    label: t('Extra Controls'),
    renderTrigger: true,
    default: false,
    description: t(
      'Whether to show extra controls or not. Extra controls ' +
        'include things like making mulitBar charts stacked ' +
        'or side by side.',
    ),
  },
};

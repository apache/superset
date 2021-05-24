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
  formatSelectOptions,
  D3_FORMAT_OPTIONS,
  sections,
} from '@superset-ui/chart-controls';
import {
  showLegend,
  xAxisLabel,
  yAxisLabel,
  bottomMargin,
  xTicksLayout,
  xAxisFormat,
  yLogScale,
  xAxisShowMinmax,
  yAxisShowMinmax,
  leftMargin,
} from '../NVD3Controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['series'],
        ['entity'],
        ['x'],
        ['y'],
        ['adhoc_filters'],
        ['size'],
        [
          {
            name: 'max_bubble_size',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Max Bubble Size'),
              default: '25',
              choices: formatSelectOptions(['5', '10', '15', '25', '50', '75', '100']),
            },
          },
        ],
        ['limit', null],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      tabOverride: 'customize',
      controlSetRows: [
        ['color_scheme', 'label_colors'],
        [showLegend, null],
      ],
    },
    {
      label: t('X Axis'),
      expanded: true,
      tabOverride: 'customize',
      controlSetRows: [
        [xAxisLabel, leftMargin],
        [
          {
            name: xAxisFormat.name,
            config: {
              ...xAxisFormat.config,
              default: 'SMART_NUMBER',
              choices: D3_FORMAT_OPTIONS,
            },
          },
          xTicksLayout,
        ],
        [
          {
            name: 'x_log_scale',
            config: {
              type: 'CheckboxControl',
              label: t('X Log Scale'),
              default: false,
              renderTrigger: true,
              description: t('Use a log scale for the X-axis'),
            },
          },
          xAxisShowMinmax,
        ],
      ],
    },
    {
      label: t('Y Axis'),
      expanded: true,
      tabOverride: 'customize',
      controlSetRows: [
        [yAxisLabel, bottomMargin],
        ['y_axis_format', null],
        [yLogScale, yAxisShowMinmax],
      ],
    },
  ],
  controlOverrides: {
    color_scheme: {
      renderTrigger: false,
    },
  },
};

export default config;

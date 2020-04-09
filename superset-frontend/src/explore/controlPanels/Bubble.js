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
import { t } from '@superset-ui/translation';

export default {
  label: t('Bubble Chart'),
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['series', 'entity'],
        ['x'],
        ['y'],
        ['adhoc_filters'],
        ['size'],
        ['max_bubble_size'],
        ['limit', null],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme', 'label_colors'],
        ['show_legend', null],
      ],
    },
    {
      label: t('X Axis'),
      expanded: true,
      controlSetRows: [
        ['x_axis_label', 'left_margin'],
        ['x_axis_format', 'x_ticks_layout'],
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
          'x_axis_showminmax',
        ],
      ],
    },
    {
      label: t('Y Axis'),
      expanded: true,
      controlSetRows: [
        ['y_axis_label', 'bottom_margin'],
        ['y_axis_format', null],
        ['y_log_scale', 'y_axis_showminmax'],
      ],
    },
  ],
  controlOverrides: {
    color_scheme: {
      renderTrigger: false,
    },
  },
};

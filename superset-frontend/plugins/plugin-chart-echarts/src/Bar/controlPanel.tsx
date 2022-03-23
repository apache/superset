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
import { t, validateNonEmpty } from '@superset-ui/core';
import {
  ControlPanelConfig,
  sections,
  sharedControls,
  emitFilterControl,
} from '@superset-ui/chart-controls';

import { legendSection } from '../controls';
import { LABEL_LOCATIONS } from './types';

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['groupby'],
        ['metrics'],
        ['adhoc_filters'],
        emitFilterControl,
        ['row_limit'],
        [
          {
            name: 'series_limit_metric',
            config: {
              ...sharedControls.series_limit_metric,
              description: t(
                'Metric used to define how the top series are sorted if a series or cell limit is present. ' +
                  'If undefined reverts to the first metric (where appropriate).',
              ),
            },
          },
        ],
        [
          {
            name: 'order_desc',
            config: {
              type: 'CheckboxControl',
              label: t('Sort Descending'),
              default: true,
              description: t('Whether to sort descending or ascending'),
            },
          },
        ],
        // [
        //   {
        //     name: 'animate',
        //     config: {
        //       default: true,
        //       type: 'CheckboxControl',
        //       label: t('Animate'),
        //       description: t(
        //         'Turn on animation for EChart transition.',
        //       ),
        //     },
        //   },
        // ]
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme'],
        [
          {
            name: 'vertical',
            config: {
              type: 'CheckboxControl',
              label: t('Use Vertical Bars'),
              renderTrigger: true,
              default: false,
              description: t('Whether to display vertical bars.'),
            },
          },
        ],
        [
          {
            name: 'stack',
            config: {
              type: 'CheckboxControl',
              label: t('Use Stacked Bars'),
              renderTrigger: true,
              default: true,
              description: t('Whether to display stacked bars.'),
            },
          },
        ],
        ...legendSection.slice(0, -1),
        [<h1 className="section-header">{t('Labels')}</h1>],
        [
          {
            name: 'x_axis_label',
            config: {
              type: 'TextControl',
              label: t('X Axis Label'),
              renderTrigger: true,
              default: '',
            },
          },
        ],
        [
          {
            name: 'x_axis_label_location',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('X Axis Label Location'),
              renderTrigger: true,
              choices: LABEL_LOCATIONS,
              default: 'center',
            },
          },
        ],
        [
          {
            name: 'x_axis_label_padding',
            config: {
              type: 'TextControl',
              label: t('X Axis Label Padding'),
              renderTrigger: true,
              default: '',
            },
          },
        ],
        [
          {
            name: 'y_axis_label',
            config: {
              type: 'TextControl',
              label: t('Y Axis Label'),
              renderTrigger: true,
              default: '',
            },
          },
        ],
        [
          {
            name: 'y_axis_label_location',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Y Axis Label Location'),
              renderTrigger: true,
              choices: LABEL_LOCATIONS,
              default: 'center',
            },
          },
        ],
        [
          {
            name: 'y_axis_label_padding',
            config: {
              type: 'TextControl',
              label: t('Y Axis Label Padding'),
              renderTrigger: true,
              default: '',
            },
          },
        ],
      ],
    },
  ],
  controlOverrides: {
    series: {
      validators: [validateNonEmpty],
      clearable: false,
    },
    row_limit: {
      default: 100,
    },
  },
};

export default config;

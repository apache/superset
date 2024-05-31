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
import {
  GenericDataType,
  t,
  validateInteger,
  validateNonEmpty,
} from '@superset-ui/core';
import {
  ControlPanelConfig,
  columnChoices,
  formatSelectOptionsForRange,
} from '@superset-ui/chart-controls';
import { showLegendControl, showValueControl } from '../controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'column',
            config: {
              type: 'SelectControl',
              label: t('Numeric column'),
              multi: false,
              description: t('Select the numeric column to draw the histogram'),
              default: null,
              validators: [validateNonEmpty],
              mapStateToProps: ({ datasource }) => ({
                choices: columnChoices(datasource, GenericDataType.Numeric),
              }),
            },
          },
        ],
        ['groupby'],
        ['adhoc_filters'],
        ['row_limit'],
        [
          {
            name: 'bins',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Bins'),
              default: 5,
              choices: formatSelectOptionsForRange(5, 20, 5),
              description: t('The number of bins for the histogram'),
              validators: [validateInteger],
            },
          },
        ],
        [
          {
            name: 'normalize',
            config: {
              type: 'CheckboxControl',
              label: t('Normalize'),
              description: t(`
                The normalize option adjusts histogram bar heights
                for easy comparison of distributions. Enabling normalize scales the
                histogram so that the tallest bar reaches a maximum value of 1, highlighting
                relative proportions and distribution shapes. Note that normalize only affects
                the histogram display, not the original data.`),
              default: false,
            },
          },
        ],
        [
          {
            name: 'cumulative',
            config: {
              type: 'CheckboxControl',
              label: t('Cumulative'),
              description: t(`
                The cumulative option in a histogram allows you to see how
                your data accumulates over different values. When enabled, the histogram bars
                represent the running total of frequencies up to each bin. This helps you
                understand how likely it is to encounter values below a certain point. Keep
                in mind that enabling cumulative doesn't change your original data, it just
                changes the way the histogram is displayed.`),
              default: false,
            },
          },
        ],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme'],
        [showValueControl],
        [showLegendControl],
        [
          {
            name: 'x_axis_title',
            config: {
              type: 'TextControl',
              label: t('X Axis Title'),
              renderTrigger: true,
              default: '',
            },
          },
        ],
        [
          {
            name: 'y_axis_title',
            config: {
              type: 'TextControl',
              label: t('Y Axis Title'),
              renderTrigger: true,
              default: '',
            },
          },
        ],
      ],
    },
  ],
};

export default config;

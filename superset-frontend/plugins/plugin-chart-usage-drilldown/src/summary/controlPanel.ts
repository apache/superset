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
import { validateNonEmpty } from '@superset-ui/core';
import {
  ControlPanelConfig,
  getStandardizedControls,
  sharedControls,
  temporalColumnMixin,
} from '@superset-ui/chart-controls';
import {
  DEFAULT_BAR_COLOR,
  DEFAULT_FAILED_COLOR,
  DEFAULT_SUCCESS_COLOR,
} from './transformProps';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [['x_axis'], ['metric'], ['adhoc_filters']],
    },
    {
      label: t('Success / failed'),
      description: t(
        'Set both metrics to show the success and failed panel next to the bars.',
      ),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'success_metric',
            config: {
              ...sharedControls.metric,
              label: t('Success metric'),
              description: t('e.g. SUM(success_calls)'),
              validators: [],
              clearable: true,
            },
          },
        ],
        [
          {
            name: 'failed_metric',
            config: {
              ...sharedControls.metric,
              label: t('Failed metric'),
              description: t('e.g. SUM(failed_calls)'),
              validators: [],
              clearable: true,
            },
          },
        ],
        [
          {
            name: 'success_color',
            config: {
              type: 'ColorPickerControl',
              label: t('Success color'),
              renderTrigger: true,
              default: DEFAULT_SUCCESS_COLOR,
            },
          },
          {
            name: 'failed_color',
            config: {
              type: 'ColorPickerControl',
              label: t('Failed color'),
              renderTrigger: true,
              default: DEFAULT_FAILED_COLOR,
            },
          },
        ],
      ],
    },
    {
      label: t('Options'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'header',
            config: {
              type: 'TextControl',
              label: t('Header'),
              renderTrigger: true,
              description: t(
                'Label above the total. Defaults to the metric name.',
              ),
            },
          },
        ],
        [
          {
            name: 'bucket_sizes',
            config: {
              type: 'TextControl',
              label: t('Bucket sizes (days)'),
              renderTrigger: true,
              default: '1, 3, 7',
              description: t(
                'Comma-separated bucket sizes the viewer can switch between, e.g. "1, 3, 7" or "1, 7, 30". The chart starts with the smallest size that gives at most 60 bars. Time ranges of 2 days or less are drawn per hour instead.',
              ),
            },
          },
        ],
        [
          {
            name: 'value_unit',
            config: {
              type: 'TextControl',
              label: t('Value unit'),
              renderTrigger: true,
              default: 'calls',
              description: t(
                'Word shown after the value in the tooltip, e.g. "calls".',
              ),
            },
          },
        ],
        ['color_picker'],
      ],
    },
  ],
  controlOverrides: {
    x_axis: {
      label: t('Time column'),
      ...temporalColumnMixin,
    },
    metric: {
      validators: [validateNonEmpty],
    },
    color_picker: {
      label: t('Bar color'),
      description: t('Color of the bars.'),
      default: DEFAULT_BAR_COLOR,
    },
  },
  formDataOverrides: formData => ({
    ...formData,
    metric: getStandardizedControls().shiftMetric(),
  }),
};

export default config;

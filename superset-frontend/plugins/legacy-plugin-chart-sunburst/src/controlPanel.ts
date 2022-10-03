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
  ControlPanelsContainerProps,
  getStandardizedControls,
  sections,
} from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['groupby'],
        ['metric'],
        ['secondary_metric'],
        ['adhoc_filters'],
        ['row_limit'],
        [
          {
            name: 'sort_by_metric',
            config: {
              type: 'CheckboxControl',
              label: t('Sort by metric'),
              description: t(
                'Whether to sort results by the selected metric in descending order.',
              ),
            },
          },
        ],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [['color_scheme'], ['linear_color_scheme']],
    },
  ],
  controlOverrides: {
    metric: {
      label: t('Primary Metric'),
      description: t(
        'The primary metric is used to define the arc segment sizes',
      ),
    },
    secondary_metric: {
      label: t('Secondary Metric'),
      default: null,
      description: t(
        '[optional] this secondary metric is used to ' +
          'define the color as a ratio against the primary metric. ' +
          'When omitted, the color is categorical and based on labels',
      ),
    },
    color_scheme: {
      description: t(
        'When only a primary metric is provided, a categorical color scale is used.',
      ),
      visibility: ({ controls }: ControlPanelsContainerProps) =>
        Boolean(
          !controls?.secondary_metric?.value ||
            controls?.secondary_metric?.value === controls?.metric.value,
        ),
    },
    linear_color_scheme: {
      description: t(
        'When a secondary metric is provided, a linear color scale is used.',
      ),
      visibility: ({ controls }: ControlPanelsContainerProps) =>
        Boolean(
          controls?.secondary_metric?.value &&
            controls?.secondary_metric?.value !== controls?.metric.value,
        ),
    },
    groupby: {
      label: t('Hierarchy'),
      description: t('This defines the level of the hierarchy'),
    },
  },
  formDataOverrides: formData => ({
    ...formData,
    groupby: getStandardizedControls().popAllColumns(),
    metric: getStandardizedControls().shiftMetric(),
    secondary_metric: getStandardizedControls().shiftMetric(),
  }),
};

export default config;

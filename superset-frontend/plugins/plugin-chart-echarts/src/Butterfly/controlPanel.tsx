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
import { ensureIsArray } from '@superset-ui/core';
import {
  ControlPanelConfig,
  ControlSubSectionHeader,
  formatSelectOptions,
  getStandardizedControls,
  sections,
  sharedControls,
} from '@superset-ui/chart-controls';
import {
  legendSection,
  showValueControl,
  xAxisLabelRotation,
} from '../controls';
import { DEFAULT_FORM_DATA } from './constants';

const { xAxisTitleMargin, yAxisTitleMargin } = DEFAULT_FORM_DATA;

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['groupby'],
        [
          {
            name: 'left_metric',
            config: {
              ...sharedControls.metric,
              label: t('Left metric'),
              description: t(
                'Metric displayed on the left side of the butterfly chart',
              ),
            },
          },
        ],
        [
          {
            name: 'right_metric',
            config: {
              ...sharedControls.metric,
              label: t('Right metric'),
              description: t(
                'Metric displayed on the right side of the butterfly chart',
              ),
            },
          },
        ],
        ['adhoc_filters'],
        ['row_limit'],
        ['orderby'],
        [
          {
            name: 'order_desc',
            config: {
              ...sharedControls.order_desc,
              visibility: ({ controls }) => Boolean(controls.orderby.value),
            },
          },
        ],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [[showValueControl], ...legendSection],
    },
    {
      label: t('Series settings'),
      expanded: true,
      controlSetRows: [
        [
          <ControlSubSectionHeader>
            {t('Left series setting')}
          </ControlSubSectionHeader>,
        ],
        [
          {
            name: 'left_color',
            config: {
              label: t('Left color'),
              type: 'ColorPickerControl',
              default: { r: 84, g: 112, b: 198, a: 1 },
              renderTrigger: true,
              description: t('Color for bars on the left side of the chart'),
            },
          },
          {
            name: 'left_label',
            config: {
              label: t('Left label'),
              type: 'TextControl',
              renderTrigger: true,
              description: t(
                'Customize the label for the left series in tooltips and legend',
              ),
            },
          },
        ],
        [
          <ControlSubSectionHeader>
            {t('Right series setting')}
          </ControlSubSectionHeader>,
        ],
        [
          {
            name: 'right_color',
            config: {
              label: t('Right color'),
              type: 'ColorPickerControl',
              default: { r: 145, g: 204, b: 117, a: 1 },
              renderTrigger: true,
              description: t('Color for bars on the right side of the chart'),
            },
          },
          {
            name: 'right_label',
            config: {
              label: t('Right label'),
              type: 'TextControl',
              renderTrigger: true,
              description: t(
                'Customize the label for the right series in tooltips and legend',
              ),
            },
          },
        ],
      ],
    },
    {
      label: t('X Axis'),
      expanded: true,
      controlSetRows: [
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
            name: 'x_axis_title_margin',
            config: {
              type: 'SelectControl',
              freeForm: true,
              clearable: true,
              label: t('X Axis title margin'),
              renderTrigger: true,
              default: xAxisTitleMargin,
              choices: formatSelectOptions(sections.TITLE_MARGIN_OPTIONS),
            },
          },
        ],
        ['x_axis_format'],
        ['currency_format'],
      ],
    },
    {
      label: t('Y Axis'),
      expanded: true,
      controlSetRows: [
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
            name: 'y_axis_title_margin',
            config: {
              type: 'SelectControl',
              freeForm: true,
              clearable: true,
              label: t('Y Axis title margin'),
              renderTrigger: true,
              default: yAxisTitleMargin,
              choices: formatSelectOptions(sections.TITLE_MARGIN_OPTIONS),
            },
          },
        ],
        [
          {
            name: xAxisLabelRotation.name,
            config: {
              ...xAxisLabelRotation.config,
              label: t('Rotate category label'),
              description: t(
                'Input field supports custom rotation. e.g. 30 for 30°',
              ),
            },
          },
        ],
      ],
    },
  ],
  controlOverrides: {
    groupby: {
      label: t('Categories'),
      description: t('Dimension used for category labels on the vertical axis'),
      multi: false,
    },
  },
  formDataOverrides: formData => ({
    ...formData,
    groupby: ensureIsArray(getStandardizedControls().shiftColumn()),
    left_metric: getStandardizedControls().shiftMetric(),
    right_metric: getStandardizedControls().shiftMetric(),
  }),
};

export default config;

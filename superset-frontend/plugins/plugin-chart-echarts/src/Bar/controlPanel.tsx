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
import { t, validateNonEmpty } from '@superset-ui/core';
import {
  ControlPanelConfig,
  sections,
  sharedControls,
  emitFilterControl
} from '@superset-ui/chart-controls';

import {
  legendSection
} from '../controls';

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
        ...legendSection,
        // [
        //   {
        //     name: 'show_labels_threshold',
        //     config: {
        //       type: 'TextControl',
        //       label: t('Percentage threshold'),
        //       renderTrigger: true,
        //       isFloat: true,
        //       default: 5,
        //       description: t(
        //         'Minimum threshold in percentage points for showing labels.',
        //       ),
        //     },
        //   },
        // ],
        //...legendSection,
        // eslint-disable-next-line react/jsx-key
        // [<h1 className="section-header">{t('Labels')}</h1>],
        // [
        //   {
        //     name: 'label_type',
        //     config: {
        //       type: 'SelectControl',
        //       label: t('Label Type'),
        //       default: labelType,
        //       renderTrigger: true,
        //       choices: [
        //         ['key', 'Category Name'],
        //         ['value', 'Value'],
        //         ['percent', 'Percentage'],
        //         ['key_value', 'Category and Value'],
        //         ['key_percent', 'Category and Percentage'],
        //         ['key_value_percent', 'Category, Value and Percentage'],
        //       ],
        //       description: t('What should be shown on the label?'),
        //     },
        //   },
        // ],
        // [
        //   {
        //     name: 'number_format',
        //     config: {
        //       type: 'SelectControl',
        //       freeForm: true,
        //       label: t('Number format'),
        //       renderTrigger: true,
        //       default: numberFormat,
        //       choices: D3_FORMAT_OPTIONS,
        //       description: `${t(
        //         'D3 format syntax: https://github.com/d3/d3-format',
        //       )} ${t('Only applies when "Label Type" is set to show values.')}`,
        //     },
        //   },
        // ],
        // [
        //   {
        //     name: 'date_format',
        //     config: {
        //       type: 'SelectControl',
        //       freeForm: true,
        //       label: t('Date format'),
        //       renderTrigger: true,
        //       choices: D3_TIME_FORMAT_OPTIONS,
        //       default: 'smart_date',
        //       description: D3_FORMAT_DOCS,
        //     },
        //   },
        // ],
        // [
        //   {
        //     name: 'show_labels',
        //     config: {
        //       type: 'CheckboxControl',
        //       label: t('Show Labels'),
        //       renderTrigger: true,
        //       default: showLabels,
        //       description: t('Whether to display the labels.'),
        //     },
        //   },
        // ],
        // [
        //   {
        //     name: 'labels_outside',
        //     config: {
        //       type: 'CheckboxControl',
        //       label: t('Put labels outside'),
        //       default: labelsOutside,
        //       renderTrigger: true,
        //       description: t('Put the labels outside of the pie?'),
        //       visibility: ({ controls }: ControlPanelsContainerProps) =>
        //         Boolean(controls?.show_labels?.value),
        //     },
        //   },
        // ],
        // [
        //   {
        //     name: 'label_line',
        //     config: {
        //       type: 'CheckboxControl',
        //       label: t('Label Line'),
        //       default: labelLine,
        //       renderTrigger: true,
        //       description: t(
        //         'Draw line from Pie to label when labels outside?',
        //       ),
        //       visibility: ({ controls }: ControlPanelsContainerProps) =>
        //         Boolean(controls?.show_labels?.value),
        //     },
        //   },
        // ],
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

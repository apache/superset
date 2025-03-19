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
  ControlStateMapping,
  ControlSubSectionHeader,
  D3_FORMAT_DOCS,
  D3_FORMAT_OPTIONS,
  D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT,
  getStandardizedControls,
  sharedControls,
} from '@superset-ui/chart-controls';
import {
  DEFAULT_FORM_DATA,
  EchartsFunnelLabelTypeType,
  PercentCalcType,
} from './types';
import { legendSection } from '../controls';

const { labelType, numberFormat, showLabels, defaultTooltipLabel } =
  DEFAULT_FORM_DATA;

const funnelLegendSection = [...legendSection];
funnelLegendSection.splice(2, 1);

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['groupby'],
        ['metric'],
        ['adhoc_filters'],
        [
          {
            name: 'row_limit',
            config: {
              ...sharedControls.row_limit,
              default: 10,
            },
          },
        ],
        [
          {
            name: 'sort_by_metric',
            config: {
              ...sharedControls.sort_by_metric,
              default: true,
            },
          },
        ],
        [
          {
            name: 'percent_calculation_type',
            config: {
              type: 'SelectControl',
              label: t('% calculation'),
              description: t(
                'Display percents in the label and tooltip as the percent of the total value, from the first step of the funnel, or from the previous step in the funnel.',
              ),
              choices: [
                [PercentCalcType.FirstStep, t('Calculate from first step')],
                [
                  PercentCalcType.PreviousStep,
                  t('Calculate from previous step'),
                ],
                [PercentCalcType.Total, t('Percent of total')],
              ],
              default: PercentCalcType.FirstStep,
              renderTrigger: true,
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
        ...funnelLegendSection,
        // eslint-disable-next-line react/jsx-key
        [<ControlSubSectionHeader>{t('Labels')}</ControlSubSectionHeader>],
        [
          {
            name: 'label_type',
            config: {
              type: 'SelectControl',
              label: t('Label Contents'),
              default: labelType,
              renderTrigger: true,
              choices: [
                [EchartsFunnelLabelTypeType.Key, t('Category Name')],
                [EchartsFunnelLabelTypeType.Value, t('Value')],
                [EchartsFunnelLabelTypeType.Percent, t('Percentage')],
                [EchartsFunnelLabelTypeType.KeyValue, t('Category and Value')],
                [
                  EchartsFunnelLabelTypeType.KeyPercent,
                  t('Category and Percentage'),
                ],
                [
                  EchartsFunnelLabelTypeType.KeyValuePercent,
                  t('Category, Value and Percentage'),
                ],
                [
                  EchartsFunnelLabelTypeType.ValuePercent,
                  t('Value and Percentage'),
                ],
              ],
              description: t('What should be shown as the label'),
            },
          },
        ],
        [
          {
            name: 'tooltip_label_type',
            config: {
              type: 'SelectControl',
              label: t('Tooltip Contents'),
              default: defaultTooltipLabel,
              renderTrigger: true,
              choices: [
                [EchartsFunnelLabelTypeType.Key, t('Category Name')],
                [EchartsFunnelLabelTypeType.Value, t('Value')],
                [EchartsFunnelLabelTypeType.Percent, t('Percentage')],
                [EchartsFunnelLabelTypeType.KeyValue, t('Category and Value')],
                [
                  EchartsFunnelLabelTypeType.KeyPercent,
                  t('Category and Percentage'),
                ],
                [
                  EchartsFunnelLabelTypeType.KeyValuePercent,
                  t('Category, Value and Percentage'),
                ],
              ],
              description: t('What should be shown as the tooltip label'),
            },
          },
        ],
        [
          {
            name: 'number_format',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Number format'),
              renderTrigger: true,
              default: numberFormat,
              choices: D3_FORMAT_OPTIONS,
              description: `${D3_FORMAT_DOCS} ${D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT}`,
            },
          },
        ],
        ['currency_format'],
        [
          {
            name: 'show_labels',
            config: {
              type: 'CheckboxControl',
              label: t('Show Labels'),
              renderTrigger: true,
              default: showLabels,
              description: t('Whether to display the labels.'),
            },
          },
        ],
        [
          {
            name: 'show_tooltip_labels',
            config: {
              type: 'CheckboxControl',
              label: t('Show Tooltip Labels'),
              renderTrigger: true,
              default: showLabels,
              description: t('Whether to display the tooltip labels.'),
            },
          },
        ],
      ],
    },
  ],
  onInit(state: ControlStateMapping) {
    return {
      ...state,
      row_limit: {
        ...state.row_limit,
        value: state.row_limit.default,
      },
    };
  },
  formDataOverrides: formData => ({
    ...formData,
    metric: getStandardizedControls().shiftMetric(),
    groupby: getStandardizedControls().popAllColumns(),
  }),
};

export default config;

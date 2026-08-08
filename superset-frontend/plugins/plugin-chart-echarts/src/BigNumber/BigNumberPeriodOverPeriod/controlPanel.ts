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
import { GenericDataType } from '@apache-superset/core/common';
import {
  ControlPanelConfig,
  getStandardizedControls,
  sharedControls,
  sections,
  ColorSchemeEnum,
} from '@superset-ui/chart-controls';
import { noop } from 'lodash-es';
import {
  headerFontSize,
  subheaderFontSize,
  subtitleControl,
  subtitleFontSize,
  showMetricNameControl,
  metricNameFontSizeWithVisibility,
} from '../sharedControls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['metric'],
        ['adhoc_filters'],
        [
          {
            name: 'row_limit',
            config: sharedControls.row_limit,
          },
        ],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['y_axis_format'],
        [
          {
            name: 'percentDifferenceFormat',
            config: {
              ...sharedControls.y_axis_format,
              label: t('Percent Difference format'),
            },
          },
        ],
        ['currency_format'],
        [
          {
            ...headerFontSize,
            config: { ...headerFontSize.config, default: 0.2 },
          },
        ],
        [subtitleControl],
        [subtitleFontSize],
        [showMetricNameControl],
        [metricNameFontSizeWithVisibility],
        [
          {
            ...subheaderFontSize,
            config: {
              ...subheaderFontSize.config,
              default: 0.125,
              label: t('Comparison font size'),
            },
          },
        ],
        [
          {
            name: 'comparison_color_enabled',
            config: {
              type: 'CheckboxControl',
              label: t('Add color for positive/negative change'),
              renderTrigger: true,
              default: false,
              description: t('Add color for positive/negative change'),
            },
          },
        ],
        [
          {
            name: 'increase_color',
            config: {
              type: 'ColorPickerControl',
              label: t('Color for increase'),
              default: ColorSchemeEnum.Green,
              renderTrigger: true,
              presets: [
                {
                  label: t('Semantic colors'),
                  colors: [ColorSchemeEnum.Green, ColorSchemeEnum.Red],
                },
              ],
              resolveThemeTokens: true,
              outputFormat: 'hex',
              visibility: ({ controls }) =>
                controls?.comparison_color_enabled?.value === true,
              description: t(
                'Color used for the arrow and symbols when the metric ' +
                  'increased from the comparison value. Defaults to green.',
              ),
            },
          },
          {
            name: 'decrease_color',
            config: {
              type: 'ColorPickerControl',
              label: t('Color for decrease'),
              default: ColorSchemeEnum.Red,
              renderTrigger: true,
              presets: [
                {
                  label: t('Semantic colors'),
                  colors: [ColorSchemeEnum.Green, ColorSchemeEnum.Red],
                },
              ],
              resolveThemeTokens: true,
              outputFormat: 'hex',
              visibility: ({ controls }) =>
                controls?.comparison_color_enabled?.value === true,
              description: t(
                'Color used for the arrow and symbols when the metric ' +
                  'decreased from the comparison value. Defaults to red.',
              ),
            },
          },
        ],
        [
          {
            name: 'column_config',
            config: {
              type: 'ColumnConfigControl',
              label: t('Customize columns'),
              description: t('Further customize how to display each column'),
              width: 400,
              height: 320,
              renderTrigger: true,
              configFormLayout: {
                [GenericDataType.Numeric]: [
                  {
                    tab: t('General'),
                    children: [
                      ['customColumnName'],
                      ['displayTypeIcon'],
                      ['visible'],
                    ],
                  },
                ],
              },
              shouldMapStateToProps() {
                return true;
              },
              mapStateToProps(explore, _, chart) {
                noop(explore, _, chart);
                return {
                  columnsPropsObject: {
                    colnames: ['Previous value', 'Delta', 'Percent change'],
                    coltypes: [
                      GenericDataType.Numeric,
                      GenericDataType.Numeric,
                      GenericDataType.Numeric,
                    ],
                  },
                };
              },
            },
          },
        ],
      ],
    },
    sections.timeComparisonControls({
      multi: false,
      showCalculationType: false,
      showFullChoices: false,
    }),
  ],
  controlOverrides: {
    y_axis_format: {
      label: t('Number format'),
    },
  },
  formDataOverrides: formData => ({
    ...formData,
    metric: getStandardizedControls().shiftMetric(),
  }),
};

export default config;

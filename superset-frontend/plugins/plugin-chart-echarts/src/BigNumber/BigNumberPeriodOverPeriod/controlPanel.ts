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
  ComparisonTimeRangeType,
  t,
  validateTimeComparisonRangeValues,
} from '@superset-ui/core';
import {
  ControlPanelConfig,
  ControlPanelState,
  ControlState,
  getStandardizedControls,
  sharedControls,
} from '@superset-ui/chart-controls';
import { headerFontSize, subheaderFontSize } from '../sharedControls';

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
            name: 'time_comparison',
            config: {
              type: 'SelectControl',
              label: t('Range for Comparison'),
              default: 'r',
              choices: [
                ['r', 'Inherit range from time filters'],
                ['y', 'Year'],
                ['m', 'Month'],
                ['w', 'Week'],
                ['c', 'Custom'],
              ],
              rerender: ['adhoc_custom'],
              description: t(
                'Set the time range that will be used for the comparison metrics. ' +
                  'For example, "Year" will compare to the same dates one year earlier. ' +
                  'Use "Inherit range from time filters" to shift the comparison time range' +
                  'by the same length as your time range and use "Custom" to set a custom comparison range.',
              ),
            },
          },
        ],
        [
          {
            name: `adhoc_custom`,
            config: {
              ...sharedControls.adhoc_filters,
              label: t('Filters for Comparison'),
              description:
                'This only applies when selecting the Range for Comparison Type: Custom',
              visibility: ({ controls }) =>
                controls?.time_comparison?.value ===
                ComparisonTimeRangeType.Custom,
              mapStateToProps: (
                state: ControlPanelState,
                controlState: ControlState,
              ) => ({
                ...(sharedControls.adhoc_filters.mapStateToProps?.(
                  state,
                  controlState,
                ) || {}),
                externalValidationErrors: validateTimeComparisonRangeValues(
                  state.controls?.time_comparison?.value,
                  controlState.value,
                ),
              }),
            },
          },
        ],
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
        ['currency_format'],
        [
          {
            ...headerFontSize,
            config: { ...headerFontSize.config, default: 0.2 },
          },
        ],
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
      ],
    },
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

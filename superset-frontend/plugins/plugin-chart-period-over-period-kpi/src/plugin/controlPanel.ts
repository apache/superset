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
import { ensureIsArray, t, validateNonEmpty } from '@superset-ui/core';
import {
  ControlPanelConfig,
  ControlPanelState,
  ControlState,
  sharedControls,
} from '@superset-ui/chart-controls';

const validateTimeComparisonRangeValues = (
  timeRangeValue?: any,
  controlValue?: any,
) => {
  const isCustomTimeRange = timeRangeValue === 'c';
  const isCustomControlEmpty = controlValue?.every(
    (val: any) => ensureIsArray(val).length === 0,
  );
  return isCustomTimeRange && isCustomControlEmpty
    ? [t('Filters for comparison must have a value')]
    : [];
};

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'metrics',
            config: {
              ...sharedControls.metrics,
              // it's possible to add validators to controls if
              // certain selections/types need to be enforced
              validators: [validateNonEmpty],
            },
          },
        ],
        ['adhoc_filters'],
        [
          {
            name: 'time_comparison',
            config: {
              type: 'SelectControl',
              label: t('Range for Comparison'),
              default: 'y',
              choices: [
                ['y', 'Year'],
                ['w', 'Week'],
                ['m', 'Month'],
                ['r', 'Range'],
                ['c', 'Custom'],
              ],
              rerender: ['adhoc_custom'],
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
                controls?.time_comparison?.value === 'c',
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
            name: 'header_font_size',
            config: {
              type: 'SelectControl',
              label: t('Big Number Font Size'),
              renderTrigger: true,
              clearable: false,
              default: 60,
              options: [
                {
                  label: t('Tiny'),
                  value: 16,
                },
                {
                  label: t('Small'),
                  value: 20,
                },
                {
                  label: t('Normal'),
                  value: 30,
                },
                {
                  label: t('Large'),
                  value: 48,
                },
                {
                  label: t('Huge'),
                  value: 60,
                },
              ],
            },
          },
        ],
        [
          {
            name: 'subheader_font_size',
            config: {
              type: 'SelectControl',
              label: t('Subheader Font Size'),
              renderTrigger: true,
              clearable: false,
              default: 40,
              options: [
                {
                  label: t('Tiny'),
                  value: 16,
                },
                {
                  label: t('Small'),
                  value: 20,
                },
                {
                  label: t('Normal'),
                  value: 26,
                },
                {
                  label: t('Large'),
                  value: 32,
                },
                {
                  label: t('Huge'),
                  value: 40,
                },
              ],
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
};

export default config;

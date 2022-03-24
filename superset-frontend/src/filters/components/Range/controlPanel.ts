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
  sections,
  sharedControls,
} from '@superset-ui/chart-controls';
import { SingleValueType } from './SingleValueType';
import { SCALING_FUNCTION_ENUM_TO_SCALING_FUNCTION } from './types';

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'groupby',
            config: {
              ...sharedControls.groupby,
              label: 'Column',
              required: true,
            },
          },
        ],
      ],
    },
    {
      label: t('UI Configuration'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'enableEmptyFilter',
            config: {
              type: 'CheckboxControl',
              label: t('Filter value is required'),
              default: false,
              renderTrigger: true,
              description: t(
                'User must select a value before applying the filter',
              ),
            },
          },
          {
            name: 'enableSingleValue',
            config: {
              type: 'CheckboxControl',
              label: t('Single value'),
              default: SingleValueType.Exact,
              renderTrigger: true,
              description: t('Use only a single value.'),
            },
          },
        ],
        [
          {
            name: 'scaling',
            config: {
              type: 'SelectControl',
              label: t('Scaling Function'),
              default: SCALING_FUNCTION_ENUM_TO_SCALING_FUNCTION.LINEAR,
              renderTrigger: true,
              freeForm: false,
              choices: Object.keys(
                SCALING_FUNCTION_ENUM_TO_SCALING_FUNCTION,
              ).map(key => [
                key,
                SCALING_FUNCTION_ENUM_TO_SCALING_FUNCTION[key].display,
              ]),
              description: t('Choose a scaling function for the slider.'),
            },
          },
          {
            name: 'stepSize',
            config: {
              type: 'SelectControl',
              label: t('Step Size'),
              default: 1,
              renderTrigger: true,
              freeForm: true,
              choices: [
                [0.001, 0.001],
                [0.01, 0.01],
                [0.1, 0.1],
                [1, 1],
                [2, 2],
                [10, 10],
                [25, 25],
                [100, 100],
              ],
              description: t('Set the slider step size.'),
            },
          },
        ],
      ],
    },
  ],
};

export default config;

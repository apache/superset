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
              label: t('Required'),
              default: false,
              renderTrigger: true,
              description: t('User must select a value for this filter.'),
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
            name: 'logScale',
            config: {
              type: 'CheckboxControl',
              label: t('Logarithmic Scale'),
              default: false,
              renderTrigger: true,
              description: t('Make the scale logarithmic.'),
            },
          },
        ],
        [
          {
            name: 'stepSize',
            config: {
              type: 'SelectControl',
              label: t('Step Size'),
              default: 1,
              renderTrigger: true,
              freeForm: true,
              choices: [
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
        [
          {
            name: 'logScale',
            config: {
              type: 'CheckboxControl',
              label: t('Logarithmic Scale'),
              default: false,
              renderTrigger: true,
              description: t('Make the scale logarithmic.'),
            },
          },
        ],
        [
          {
            name: 'stepSize',
            config: {
              type: 'SelectControl',
              label: t('Step Size'),
              default: 1,
              renderTrigger: true,
              freeForm: true,
              choices: [
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

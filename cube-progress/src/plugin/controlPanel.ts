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
import {t, validateNonEmpty} from '@superset-ui/core';
import {
  ControlPanelConfig,
  sharedControls,
} from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Data'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'all_columns',
            config: {
              ...sharedControls.groupby,
              label: t('Columns'),
              description: t('Required Columns in the datafields'),
              validators: [validateNonEmpty],
            },
          },
        ],
        ['metric'],
        ['adhoc_filters'],
      ],
    },
    {
      label: t('Setup display!'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'cube_query',
            config: {
              type: 'CheckboxControl',
              label: t('Cube Query'),
              renderTrigger: true,
              default: true,
              description: t(
                'Uses the native cube query instead of the regular query'
              ),
            },
          },
        ],
        [
          {
            name: 'progress_type',
            config: {
              type: 'SelectControl',
              label: t('Progress Type'),
              default: 'line',
              choices: [
                ['line', 'Lijn'],
                ['circle', 'Cirkel'],
                ['dashboard', 'Dashboard'],
              ],
              renderTrigger: true,
              description: t('The size of your header font'),
            },
          },
        ],
      ],
    },
  ],
};

export default config;

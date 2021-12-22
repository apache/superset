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
  sharedControls,
  formatSelectOptions,
  // ControlStateMapping,
  // ControlSetRow,
  // formatSelectOptionsForRange,
} from '@superset-ui/chart-controls';

import FilterBoxItemControl from 'src/explore/components/controls/FilterBoxItemControl'

const config: ControlPanelConfig = {
 
  controlPanelSections: [
    {
      label: t('Time'),
      expanded: true,
      description: t('Time related form attributes'),
      controlSetRows: [['granularity_sqla'], ['time_range']],
    },
    {
      label: t("Groups"),
      expanded: true,
      controlSetRows: [
        [{
          name: t('groups'),
          config: {
            type: 'CollectionControl',
            label: t(' '),
            controlName: 'ScoreCardGroupControl',
            controlValue: [],
            mapStateToProps: ({datasource, form_data }) => ({
              columns: datasource?.columns.filter(c => c.filterable) || [],
              savedMetrics: datasource?.metrics || [],
              // current active adhoc metrics
              selectedMetrics:
                form_data.metrics || (form_data.metric ? [form_data.metric] : []),
              datasource,
            }),
          }
        }]
      ]
    },
    {
      label: t('Measurements'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'name',
            config: {
              type: 'TextControl',
              label: 'name',
              description: 'name of the measurement',
            }
          },
          {
            name: 'metric',
            config: {
              ...sharedControls.metric,
              label: 'metrics',
            },
          },
          {
            name: 'filter',
            config: {
              ...sharedControls.adhoc_filters,
              label: 'filter',
            },
          }
        ],

        // ...get_measurement_sections(MAX_MEASUREMENT_COUNT),
      ],
    },
    {
      label: t('Hello Controls!'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'header_text',
            config: {
              type: 'TextControl',
              default: 'Hello, World!',
              renderTrigger: true,
              // ^ this makes it apply instantaneously, without triggering a "run query" button
              label: t('Header Text'),
              description: t('The text you want to see in the header'),
            },
          },
        ],
        [
          {
            name: 'bold_text',
            config: {
              type: 'CheckboxControl',
              label: t('Bold Text'),
              renderTrigger: true,
              default: true,
              description: t('A checkbox to make the '),
            },
          },
        ],
        [
          {
            name: 'header_font_size',
            config: {
              type: 'SelectControl',
              label: t('Font Size'),
              default: 'xl',
              choices: [
                // [value, label]
                ['xxs', 'xx-small'],
                ['xs', 'x-small'],
                ['s', 'small'],
                ['m', 'medium'],
                ['l', 'large'],
                ['xl', 'x-large'],
                ['xxl', 'xx-large'],
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

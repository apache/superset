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
  sharedControls,
} from '@superset-ui/chart-controls';
import { DEFAULT_FORM_DATA } from './types';

const {
  controlType,
  multiSelect,
  enableEmptyFilter,
  defaultToFirstItem,
  sortAscending,
  inverseSelection,
} = DEFAULT_FORM_DATA;

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'groupby',
            config: {
              ...sharedControls.groupby,
              label: t('Column'),
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
            name: 'controlType',
            config: {
              type: 'SelectControl',
              renderTrigger: true,
              label: t('Control Type'),
              default: controlType,
              choices: [
                ['dropdown', t('Dropdown')],
                ['checkbox', t('Checkbox')],
                ['radio', t('Radio')],
              ],
              description: t('Select the type of UI control to display'),
            },
          },
        ],
        [
          {
            name: 'sortAscending',
            config: {
              type: 'CheckboxControl',
              renderTrigger: true,
              label: t('Sort ascending'),
              default: sortAscending,
              description: t('Check for sorting ascending'),
            },
          },
        ],
        [
          {
            name: 'multiSelect',
            config: {
              type: 'CheckboxControl',
              label: t('Can select multiple values'),
              default: multiSelect,
              resetConfig: true,
              affectsDataMask: true,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'enableEmptyFilter',
            config: {
              type: 'CheckboxControl',
              label: t('Filter value is required'),
              default: enableEmptyFilter,
              renderTrigger: true,
              description: t('User must select a value before applying the filter'),
            },
          },
        ],
        [
          {
            name: 'defaultToFirstItem',
            config: {
              type: 'CheckboxControl',
              label: t('Select first filter value by default'),
              default: defaultToFirstItem,
              resetConfig: true,
              affectsDataMask: true,
              renderTrigger: true,
              requiredFirst: true,
              description: t(
                "When using this option, default value can't be set. Using this option may impact the load times for your dashboard.",
              ),
            },
          },
        ],
        [
          {
            name: 'inverseSelection',
            config: {
              type: 'CheckboxControl',
              renderTrigger: true,
              affectsDataMask: true,
              label: t('Inverse selection'),
              default: inverseSelection,
              description: t('Exclude selected values'),
            },
          },
        ],
      ],
    },
  ],
  controlOverrides: {
    groupby: {
      multi: false,
      validators: [validateNonEmpty],
    },
  },
};

export default config;

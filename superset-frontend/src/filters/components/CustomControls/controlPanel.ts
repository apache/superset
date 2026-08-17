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
  ControlPanelConfig,
  sharedControls,
} from '@superset-ui/chart-controls';
import { t } from '@apache-superset/core/translation';

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
      label: t('Filter Settings'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'controlType',
            config: {
              type: 'SelectControl',
              label: t('Control Type'),
              default: 'Dropdown',
              choices: [
                ['Dropdown', t('Dropdown')],
                ['Radio', t('Radio Buttons')],
                ['Checkbox', t('Checkboxes')],
                ['TextBox', t('Text Box')],
              ],
              renderTrigger: true,
              affectsDataMask: true,
              resetConfig: true,
              description: t(
                'Checkbox and Radio Button controls work only for fewer than 10 elements in the list. If more than 10, it defaults to a Dropdown filter.',
              ),
            },
          },
        ],
        [
          {
            name: 'orientation',
            config: {
              type: 'SelectControl',
              label: t('Orientation'),
              default: 'vertical',
              choices: [
                ['vertical', t('Vertical')],
                ['horizontal', t('Horizontal')],
              ],
              renderTrigger: true,
              visibility: ({ controls }) =>
                ['Radio', 'Checkbox'].includes(
                  String(controls?.controlType?.value || ''),
                ),
              description: t('Choose vertical or horizontal arrangement'),
            },
          },
        ],
        [
          {
            name: 'multiSelect',
            config: {
              type: 'CheckboxControl',
              label: t('Allow Multiple Selections'),
              default: true,
              affectsDataMask: true,
              resetConfig: true,
              renderTrigger: true,
              description: t('Allow multiple items to be selected'),
            },
          },
        ],
        [
          {
            name: 'includeAllOption',
            config: {
              type: 'CheckboxControl',
              label: t('Include "All" Option'),
              default: false,
              renderTrigger: true,
              description: t('Adds an "All" option to select or deselect all items'),
            },
          },
        ],
        [
          {
            name: 'enableEmptyFilter',
            config: {
              type: 'CheckboxControl',
              label: t('Filter value is required'),
              default: false,
              renderTrigger: true,
              description: t('User must select a value before applying the filter'),
            },
          },
        ],
      ],
    },
  ],
};

export default config;

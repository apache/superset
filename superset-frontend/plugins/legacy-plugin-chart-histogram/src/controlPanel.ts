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
  FeatureFlag,
  isFeatureEnabled,
  t,
  validateNonEmpty,
} from '@superset-ui/core';
import {
  columnChoices,
  ControlPanelConfig,
  ControlPanelState,
  formatSelectOptions,
  sections,
  dndColumnsControl,
} from '@superset-ui/chart-controls';

const allColumns = {
  type: 'SelectControl',
  label: t('Columns'),
  default: null,
  description: t('Select the numeric columns to draw the histogram'),
  mapStateToProps: (state: ControlPanelState) => ({
    choices: columnChoices(state.datasource),
  }),
  multi: true,
  validators: [validateNonEmpty],
};

const dndAllColumns = {
  ...dndColumnsControl,
  description: t('Select the numeric columns to draw the histogram'),
  validators: [validateNonEmpty],
};

const columnsConfig = isFeatureEnabled(FeatureFlag.ENABLE_EXPLORE_DRAG_AND_DROP)
  ? dndAllColumns
  : allColumns;

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'all_columns_x',
            config: columnsConfig,
          },
        ],
        ['adhoc_filters'],
        ['row_limit'],
        ['groupby'],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme'],
        [
          {
            name: 'link_length',
            config: {
              type: 'SelectControl',
              renderTrigger: true,
              freeForm: true,
              label: t('No of Bins'),
              default: 5,
              choices: formatSelectOptions([
                '10',
                '25',
                '50',
                '75',
                '100',
                '150',
                '200',
                '250',
              ]),
              description: t('Select the number of bins for the histogram'),
            },
          },
        ],
        [
          {
            name: 'x_axis_label',
            config: {
              type: 'TextControl',
              label: t('X Axis Label'),
              renderTrigger: true,
              default: '',
            },
          },
        ],
        [
          {
            name: 'y_axis_label',
            config: {
              type: 'TextControl',
              label: t('Y Axis Label'),
              renderTrigger: true,
              default: '',
            },
          },
        ],
        [
          {
            name: 'show_legend',
            config: {
              type: 'CheckboxControl',
              label: t('Legend'),
              renderTrigger: true,
              default: false,
              description: t('Whether to display the legend (toggles)'),
            },
          },
        ],
        [
          {
            name: 'normalized',
            config: {
              type: 'CheckboxControl',
              label: t('Normalized'),
              renderTrigger: true,
              description: t('Whether to normalize the histogram'),
              default: false,
            },
          },
        ],
        [
          {
            name: 'cumulative',
            config: {
              type: 'CheckboxControl',
              label: t('Cumulative'),
              renderTrigger: true,
              description: t('Whether to make the histogram cumulative'),
              default: false,
            },
          },
        ],
      ],
    },
  ],
};
export default config;

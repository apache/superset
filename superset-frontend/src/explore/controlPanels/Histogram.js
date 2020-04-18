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
import { t } from '@superset-ui/translation';
import { validateNonEmpty } from '@superset-ui/validator';
import { columnChoices } from '../controls';
import { formatSelectOptions } from '../../modules/utils';

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'all_columns_x',
            config: {
              type: 'SelectControl',
              label: t('Numeric Columns'),
              default: null,
              description: t(
                'Select the numeric columns to draw the histogram',
              ),
              mapStateToProps: state => ({
                choices: columnChoices(state.datasource),
              }),
              multi: true,
              validators: [validateNonEmpty],
            },
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
        ['color_scheme', 'label_colors'],
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
      ],
    },
  ],
};

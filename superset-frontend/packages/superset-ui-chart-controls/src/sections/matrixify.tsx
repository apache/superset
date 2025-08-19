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
import { ControlPanelSectionConfig } from '../types';

export const matrixifyEnableSection: ControlPanelSectionConfig = {
  label: t('Enable matrixify'),
  expanded: true,
  controlSetRows: [
    [
      {
        name: 'matrixify_enabled',
        config: {
          type: 'CheckboxControl',
          label: t('Enable matrixify'),
          default: false,
          renderTrigger: true,
          description: t(
            'Transform this chart into a matrix/grid of charts based on dimensions or metrics',
          ),
        },
      },
    ],
  ],
  tabOverride: 'matrixify',
};

export const matrixifySection: ControlPanelSectionConfig = {
  label: t('Matrixify'),
  expanded: false,
  visibility: ({ controls }) => controls?.matrixify_enabled?.value === true,
  controlSetRows: [
    [
      {
        name: 'matrixify_row_height',
        config: {
          type: 'TextControl',
          label: t('Row height'),
          default: 300,
          isInt: true,
          renderTrigger: true,
          description: t('Height of each row in pixels'),
        },
      },
      {
        name: 'matrixify_fit_columns_dynamically',
        config: {
          type: 'CheckboxControl',
          label: t('Fit columns dynamically'),
          default: true,
          renderTrigger: true,
          description: t('Automatically adjust column width based on content'),
        },
      },
    ],
    [
      {
        name: 'matrixify_charts_per_row',
        config: {
          type: 'TextControl',
          label: t('Charts per row'),
          default: 3,
          isInt: true,
          renderTrigger: true,
          description: t(
            'Number of charts per row when not fitting dynamically',
          ),
          visibility: ({ controls }) =>
            !controls?.matrixify_fit_columns_dynamically?.value,
        },
      },
    ],
    [
      {
        name: 'matrixify_cell_title_template',
        config: {
          type: 'TextControl',
          label: t('Cell title template'),
          default: '',
          description: t(
            'Template for cell titles. Use Handlebars templating syntax (a popular templating library that uses double curly brackets for variable substitution): {{row}}, {{column}}, {{rowLabel}}, {{columnLabel}}',
          ),
          placeholder: '{{rowLabel}} by {{colLabel}}',
        },
      },
    ],
  ],
  tabOverride: 'customize',
};

export const matrixifyRowSection: ControlPanelSectionConfig = {
  label: t('Vertical layout'),
  expanded: false,
  visibility: ({ controls }) => controls?.matrixify_enabled?.value === true,
  controlSetRows: [
    ['matrixify_show_row_labels'],
    ['matrixify_mode_rows'],
    ['matrixify_rows'],
    ['matrixify_dimension_rows'],
    ['matrixify_dimension_selection_mode_rows'],
    ['matrixify_topn_value_rows'],
    ['matrixify_topn_metric_rows'],
    ['matrixify_topn_order_rows'],
  ],
  tabOverride: 'data',
};

export const matrixifyColumnSection: ControlPanelSectionConfig = {
  label: t('Horizontal layout'),
  expanded: false,
  visibility: ({ controls }) => controls?.matrixify_enabled?.value === true,
  controlSetRows: [
    ['matrixify_show_column_headers'],
    ['matrixify_mode_columns'],
    ['matrixify_columns'],
    ['matrixify_dimension_columns'],
    ['matrixify_dimension_selection_mode_columns'],
    ['matrixify_topn_value_columns'],
    ['matrixify_topn_metric_columns'],
    ['matrixify_topn_order_columns'],
  ],
  tabOverride: 'data',
};

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

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['all_columns_x'],
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
        ['link_length'],
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
        ['global_opacity'],
        ['normalized'],
      ],
    },
  ],
  controlOverrides: {
    all_columns_x: {
      label: t('Numeric Columns'),
      description: t('Select the numeric columns to draw the histogram'),
      multi: true,
      validators: [validateNonEmpty],
    },
    link_length: {
      label: t('No of Bins'),
      description: t('Select the number of bins for the histogram'),
      default: 5,
    },
    global_opacity: {
      description: t('Opacity of the bars. Between 0 and 1'),
      renderTrigger: true,
    },
  },
};

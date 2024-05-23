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
import { t, validateInteger, validateNonEmpty } from '@superset-ui/core';
import {
  ControlPanelConfig,
  dndGroupByControl,
  formatSelectOptionsForRange,
} from '@superset-ui/chart-controls';
import { showLegendControl, showValueControl } from '../controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'column',
            config: {
              ...dndGroupByControl,
              label: t('Numeric column'),
              multi: false,
              description: t('Select the numeric column to draw the histogram'),
              default: null,
              validators: [validateNonEmpty],
            },
          },
        ],
        ['groupby'],
        [
          {
            name: 'bins',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Bins'),
              default: 5,
              choices: formatSelectOptionsForRange(5, 20, 5),
              description: t('The number of bins for the histogram'),
              validators: [validateInteger],
            },
          },
        ],
        ['adhoc_filters'],
        ['row_limit'],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme'],
        [showValueControl],
        [showLegendControl],
      ],
    },
  ],
};

export default config;

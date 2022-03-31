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
import { ControlPanelConfig, sections } from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['metrics'],
        ['adhoc_filters'],
        [
          {
            name: 'groupby',
            override: {
              validators: [validateNonEmpty],
            },
          },
        ],
        ['limit', 'timeseries_limit_metric'],
        ['order_desc'],
        [
          {
            name: 'contribution',
            config: {
              type: 'CheckboxControl',
              label: t('Contribution'),
              default: false,
              description: t('Compute the contribution to the total'),
            },
          },
        ],
        ['row_limit', null],
      ],
    },
    {
      label: t('Parameters'),
      expanded: false,
      controlSetRows: [
        [
          {
            name: 'significance_level',
            config: {
              type: 'TextControl',
              label: t('Significance Level'),
              default: 0.05,
              description: t(
                'Threshold alpha level for determining significance',
              ),
            },
          },
        ],
        [
          {
            name: 'pvalue_precision',
            config: {
              type: 'TextControl',
              label: t('p-value precision'),
              default: 6,
              description: t(
                'Number of decimal places with which to display p-values',
              ),
            },
          },
        ],
        [
          {
            name: 'liftvalue_precision',
            config: {
              type: 'TextControl',
              label: t('Lift percent precision'),
              default: 4,
              description: t(
                'Number of decimal places with which to display lift values',
              ),
            },
          },
        ],
      ],
    },
  ],
};

export default config;

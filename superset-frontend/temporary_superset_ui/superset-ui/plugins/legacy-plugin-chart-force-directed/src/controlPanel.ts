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
import { formatSelectOptions, sections } from '@superset-ui/chart-controls';

export default {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['groupby'],
        ['metric'],
        ['adhoc_filters'],
        ['row_limit'],
        [
          {
            name: 'sort_by_metric',
            config: {
              type: 'CheckboxControl',
              label: t('Sort by metric'),
              description: t(
                'Whether to sort results by the selected metric in descending order.',
              ),
            },
          },
        ],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'link_length',
            config: {
              type: 'SelectControl',
              renderTrigger: true,
              freeForm: true,
              label: t('Link Length'),
              default: '200',
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
              description: t('Link length in the force layout'),
            },
          },
        ],
        [
          {
            name: 'charge',
            config: {
              type: 'SelectControl',
              renderTrigger: true,
              freeForm: true,
              label: t('Charge'),
              default: '-500',
              choices: formatSelectOptions([
                '-50',
                '-75',
                '-100',
                '-150',
                '-200',
                '-250',
                '-500',
                '-1000',
                '-2500',
                '-5000',
              ]),
              description: t('Charge in the force layout'),
            },
          },
        ],
      ],
    },
  ],
  controlOverrides: {
    groupby: {
      label: t('Source / Target'),
      description: t('Choose a source and a target'),
    },
  },
};

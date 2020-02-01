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

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['entity'],
        [
          {
            name: 'country_fieldtype',
            config: {
              type: 'SelectControl',
              label: t('Country Field Type'),
              default: 'cca2',
              choices: [
                ['name', 'Full name'],
                ['cioc', 'code International Olympic Committee (cioc)'],
                ['cca2', 'code ISO 3166-1 alpha-2 (cca2)'],
                ['cca3', 'code ISO 3166-1 alpha-3 (cca3)'],
              ],
              description: t(
                'The country code standard that Superset should expect ' +
                  'to find in the [country] column',
              ),
            },
          },
        ],
        ['metric'],
        ['adhoc_filters'],
        ['row_limit'],
      ],
    },
    {
      label: t('Bubbles'),
      controlSetRows: [
        [
          {
            name: 'show_bubbles',
            config: {
              type: 'CheckboxControl',
              label: t('Show Bubbles'),
              default: false,
              renderTrigger: true,
              description: t('Whether to display bubbles on top of countries'),
            },
          },
        ],
        ['secondary_metric'],
        ['max_bubble_size'],
      ],
    },
  ],
  controlOverrides: {
    entity: {
      label: t('Country Control'),
      description: t('3 letter code of the country'),
    },
    metric: {
      label: t('Metric for color'),
      description: t('Metric that defines the color of the country'),
    },
    secondary_metric: {
      label: t('Bubble size'),
      description: t('Metric that defines the size of the bubble'),
    },
  },
};

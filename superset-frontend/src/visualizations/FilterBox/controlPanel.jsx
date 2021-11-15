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
import React from 'react';
import { t } from '@superset-ui/core';
import { sections } from '@superset-ui/chart-controls';

const appContainer = document.getElementById('app');
const bootstrapData = JSON.parse(appContainer.getAttribute('data-bootstrap'));
const druidIsActive = !!bootstrapData?.common?.conf?.DRUID_IS_ACTIVE;
const druidSection = druidIsActive
  ? [
      [
        {
          name: 'show_druid_time_granularity',
          config: {
            type: 'CheckboxControl',
            label: t('Show Druid granularity dropdown'),
            default: false,
            description: t('Check to include Druid granularity dropdown'),
          },
        },
      ],
      [
        {
          name: 'show_druid_time_origin',
          config: {
            type: 'CheckboxControl',
            label: t('Show Druid time origin'),
            default: false,
            description: t('Check to include time origin dropdown'),
          },
        },
      ],
    ]
  : [];

export default {
  controlPanelSections: [
    sections.legacyTimeseriesTime,
    {
      label: t('Filters configuration'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'filter_configs',
            config: {
              type: 'CollectionControl',
              label: 'Filters',
              description: t('Filter configuration for the filter box'),
              validators: [],
              controlName: 'FilterBoxItemControl',
              mapStateToProps: ({ datasource }) => ({ datasource }),
            },
          },
        ],
        [<hr />],
        [
          {
            name: 'date_filter',
            config: {
              type: 'CheckboxControl',
              label: t('Date filter'),
              default: true,
              description: t('Whether to include a time filter'),
            },
          },
        ],
        [
          {
            name: 'instant_filtering',
            config: {
              type: 'CheckboxControl',
              label: t('Instant filtering'),
              renderTrigger: true,
              default: false,
              description: t(
                'Check to apply filters instantly as they change instead of displaying [Apply] button',
              ),
            },
          },
        ],
        [
          {
            name: 'show_sqla_time_granularity',
            config: {
              type: 'CheckboxControl',
              label: druidIsActive
                ? t('Show SQL time grain dropdown')
                : t('Show time grain dropdown'),
              default: false,
              description: druidIsActive
                ? t('Check to include SQL time grain dropdown')
                : t('Check to include time grain dropdown'),
            },
          },
        ],
        [
          {
            name: 'show_sqla_time_column',
            config: {
              type: 'CheckboxControl',
              label: druidIsActive
                ? t('Show SQL time column')
                : t('Show time column'),
              default: false,
              description: t('Check to include time column dropdown'),
            },
          },
        ],
        ...druidSection,
        ['adhoc_filters'],
      ],
    },
  ],
  controlOverrides: {
    adhoc_filters: {
      label: t('Limit selector values'),
      description: t(
        'These filters apply to the values available in the dropdowns',
      ),
    },
  },
};

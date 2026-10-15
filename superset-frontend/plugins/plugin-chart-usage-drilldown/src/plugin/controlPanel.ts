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
import { t } from '@apache-superset/core/translation';
import { validateNonEmpty } from '@superset-ui/core';
import {
  ControlPanelConfig,
  getStandardizedControls,
  sharedControls,
} from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['groupby'],
        ['metric'],
        [
          {
            name: 'link_column',
            config: {
              ...sharedControls.series,
              label: t('Detail link column'),
              description: t(
                'Optional column holding a URL (or an <a href> tag). A "View detail" link is shown on rows where the group has a single link.',
              ),
              validators: [],
              clearable: true,
            },
          },
        ],
        [
          {
            name: 'badge_column',
            config: {
              ...sharedControls.series,
              label: t('Badge column'),
              description: t(
                'Optional short label shown as a badge on last-level rows, e.g. the HTTP method.',
              ),
              validators: [],
              clearable: true,
            },
          },
        ],
        [
          {
            name: 'subtitle_columns',
            config: {
              ...sharedControls.groupby,
              label: t('Sub-line columns'),
              description: t(
                'Optional columns shown under the name on last-level rows, e.g. system and endpoint path.',
              ),
              validators: [],
            },
          },
        ],
        [
          {
            name: 'duration_column',
            config: {
              ...sharedControls.series,
              label: t('Duration column (ms)'),
              description: t(
                'Optional duration in milliseconds. Last-level rows show the average over runs that recorded one, in seconds.',
              ),
              validators: [],
              clearable: true,
            },
          },
        ],
        ['adhoc_filters'],
        ['row_limit'],
      ],
    },
    {
      label: t('Options'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'title_prefix',
            config: {
              type: 'TextControl',
              label: t('Title prefix'),
              renderTrigger: true,
              default: 'Usage by',
              description: t(
                'Heading shown above the table, followed by the current level, e.g. "Usage by project".',
              ),
            },
          },
        ],
      ],
    },
  ],
  controlOverrides: {
    groupby: {
      label: t('Drilldown levels'),
      description: t(
        'Columns to drill through, in order. Clicking a row opens the next level.',
      ),
      validators: [validateNonEmpty],
    },
    metric: {
      validators: [validateNonEmpty],
    },
    row_limit: {
      default: 10000,
    },
  },
  formDataOverrides: formData => ({
    ...formData,
    groupby: getStandardizedControls().popAllColumns(),
    metric: getStandardizedControls().shiftMetric(),
  }),
};

export default config;

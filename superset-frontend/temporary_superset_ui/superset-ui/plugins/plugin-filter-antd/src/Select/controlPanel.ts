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
import { DEFAULT_FORM_DATA } from './types';

const {
  enableEmptyFilter,
  fetchPredicate,
  inverseSelection,
  multiSelect,
  showSearch,
} = DEFAULT_FORM_DATA;

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['groupby'],
        ['metrics'],
        ['adhoc_filters'],
        [
          {
            name: 'multiSelect',
            config: {
              type: 'CheckboxControl',
              label: t('Multiple Select'),
              default: multiSelect,
              description: t('Allow selecting multiple values'),
            },
          },
        ],
        [
          {
            name: 'enableEmptyFilter',
            config: {
              type: 'CheckboxControl',
              label: t('Enable Empty Filter'),
              default: enableEmptyFilter,
              description: t(
                'When selection is empty, should an always false filter event be emitted',
              ),
            },
          },
        ],
        [
          {
            name: 'inverseSelection',
            config: {
              type: 'CheckboxControl',
              label: t('Inverse Selection'),
              default: inverseSelection,
              description: t('Exclude selected values'),
            },
          },
        ],
        [
          {
            name: 'showSearch',
            config: {
              type: 'CheckboxControl',
              label: t('Search Field'),
              default: showSearch,
              description: t('Allow typing search terms'),
            },
          },
        ],
        [
          {
            name: 'fetchPredicate',
            config: {
              type: 'TextControl',
              label: t('Fetch predicate'),
              default: fetchPredicate,
              description: t(
                'Predicate applied when fetching distinct value to populate the filter control component.',
              ),
            },
          },
          null,
        ],
        ['row_limit', null],
      ],
    },
  ],
  controlOverrides: {
    groupby: {
      multi: false,
      validators: [validateNonEmpty],
    },
  },
};

export default config;

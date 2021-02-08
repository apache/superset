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
import { t, validateNonEmpty } from '@superset-ui/core';
import {
  formatSelectOptionsForRange,
  ColumnOption,
  columnChoices,
  ControlPanelConfig,
  sections,
  SelectControlConfig,
  ColumnMeta,
} from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Event definition'),
      controlSetRows: [
        ['entity'],
        [
          {
            name: 'all_columns_x',
            config: {
              type: 'SelectControl',
              label: t('Event Names'),
              description: t('Columns to display'),
              mapStateToProps: state => ({
                choices: columnChoices(state?.datasource),
              }),
              // choices is from `mapStateToProps`
              default: (control: { choices?: string[] }) =>
                control.choices && control.choices.length > 0 ? control.choices[0][0] : null,
              validators: [validateNonEmpty],
            },
          },
        ],
        ['row_limit'],
        [
          {
            name: 'order_by_entity',
            config: {
              type: 'CheckboxControl',
              label: t('Order by entity id'),
              description: t(
                'Important! Select this if the table is not already sorted by entity id, ' +
                  'else there is no guarantee that all events for each entity are returned.',
              ),
              default: true,
            },
          },
        ],
        [
          {
            name: 'min_leaf_node_event_count',
            config: {
              type: 'SelectControl',
              freeForm: false,
              label: t('Minimum leaf node event count'),
              default: 1,
              choices: formatSelectOptionsForRange(1, 10),
              description: t(
                'Leaf nodes that represent fewer than this number of events will be initially ' +
                  'hidden in the visualization',
              ),
            },
          },
        ],
      ],
    },
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [['adhoc_filters']],
    },
    {
      label: t('Additional metadata'),
      controlSetRows: [
        [
          {
            name: 'all_columns',
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            config: {
              type: 'SelectControl',
              multi: true,
              label: t('Metadata'),
              default: [],
              description: t('Select any columns for metadata inspection'),
              optionRenderer: c => <ColumnOption showType column={c} />,
              valueRenderer: c => <ColumnOption column={c} />,
              valueKey: 'column_name',
              allowAll: true,
              mapStateToProps: state => ({
                options: state.datasource ? state.datasource.columns : [],
              }),
              commaChoosesOption: false,
              freeForm: true,
            } as SelectControlConfig<ColumnMeta>,
          },
        ],
      ],
    },
  ],
  controlOverrides: {
    entity: {
      label: t('Entity ID'),
      description: t('e.g., a "user id" column'),
    },
    row_limit: {
      label: t('Max Events'),
      description: t('The maximum number of events to return, equivalent to the number of rows'),
    },
  },
};

export default config;

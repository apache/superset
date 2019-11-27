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
import { nonEmpty } from '../validators';

export default {
  requiresTime: true,
  controlPanelSections: [
    {
      label: t('Event definition'),
      controlSetRows: [
        ['entity'],
        ['all_columns_x'],
        ['row_limit'],
        ['order_by_entity'],
        ['min_leaf_node_event_count'],
      ],
    },
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [['adhoc_filters']],
    },
    {
      label: t('Additional metadata'),
      controlSetRows: [['all_columns']],
    },
  ],
  controlOverrides: {
    entity: {
      label: t('Column containing entity ids'),
      description: t('e.g., a "user id" column'),
    },
    all_columns_x: {
      label: t('Column containing event names'),
      validators: [nonEmpty],
      default: control =>
        control.choices && control.choices.length > 0
          ? control.choices[0][0]
          : null,
    },
    row_limit: {
      label: t('Event count limit'),
      description: t(
        'The maximum number of events to return, equivalent to the number of rows',
      ),
    },
    all_columns: {
      label: t('Meta data'),
      description: t('Select any columns for metadata inspection'),
    },
  },
};

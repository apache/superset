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
import { t } from '@superset-ui/translation';

export default {
  controlPanelSections: [
    {
      label: t('Filters Configuration'),
      expanded: true,
      controlSetRows: [
        ['filter_configs'],
        [<hr />],
        ['date_filter', 'instant_filtering'],
        ['show_sqla_time_granularity', 'show_sqla_time_column'],
        ['show_druid_time_granularity', 'show_druid_time_origin'],
        ['adhoc_filters'],
      ],
    },
  ],
  controlOverrides: {
    adhoc_filters: {
      label: t('Limit Selector Values'),
      description: t(
        'These filters apply to the values available in the dropdowns',
      ),
    },
  },
};

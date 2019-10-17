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
      description: t('Use this section if you want to query rows'),
      expanded: true,
      controlSetRows: [
        ['all_columns_x'],
        ['all_columns_y'],
        ['all_columns'],
        ['row_limit'],
        ['order_by_cols'],
        ['adhoc_filters'],
      ],
    },
  ],
  controlOverrides: {
    all_columns_x: {
        label: 'URL Column ',
        description: t('Column to fetach images from url'),
    },
    all_columns_y: {
        label: 'Title Column',
        description: t('Column to display Title of Images'),
    },
    all_columns: {
      label: 'Extra Data Columns',
      description: t('Columns to display extra info about images on hover'),
    },
  },
};

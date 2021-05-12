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
import {
  ControlPanelConfig,
  sections,
  sharedControls,
} from '@superset-ui/chart-controls';
import { DEFAULT_FORM_DATA } from './types';

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'groupby',
            config: {
              ...sharedControls.groupby,
              label: 'Column',
              description:
                'The numeric column based on which to calculate the range',
            },
          },
        ],
        [
          {
            name: 'applyFetchValuesPredicate',
            config: {
              type: 'CheckboxControl',
              renderTrigger: true,
              label: t('Apply dataset filter predicate'),
              default: DEFAULT_FORM_DATA.apply_fetch_values_predicate,
              description: t('Apply filter predicate if defined in dataset'),
            },
          },
        ],
      ],
    },
  ],
};

export default config;

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
import { formatSelectOptions } from '../../modules/utils';

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['groupby'],
        ['metric'],
        ['adhoc_filters'],
        ['row_limit'],
      ],
    },
    {
      label: t('Options'),
      controlSetRows: [
        ['link_length'],
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

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
import { ColumnOption, t } from '@superset-ui/core';

export const controlPanelSectionsChartOptions = [
  {
    label: t('Chart Options'),
    expanded: true,
    controlSetRows: [
      [
        'color_scheme',
        {
          name: 'rose_area_proportion',
          config: {
            type: 'CheckboxControl',
            label: t('Use Area Proportions'),
            description: t(
              'Check if the Rose Chart should use segment area instead of ' +
                'segment radius for proportioning',
            ),
            default: false,
            renderTrigger: true,
          },
        },
      ],
      [
        {
          name: 'stacked_style',
          config: {
            type: 'SelectControl',
            label: t('Stacked Style'),
            renderTrigger: true,
            choices: [
              ['stack', 'stack'],
              ['stream', 'stream'],
              ['expand', 'expand'],
            ],
            default: 'stack',
            description: '',
          },
        },
      ],
    ],
  },
];

export const controlPanelSectionsChartOptionsOnlyColorScheme = [
  {
    label: t('Chart Options'),
    expanded: true,
    controlSetRows: [['color_scheme']],
  },
];

export const controlPanelSectionsChartOptionsTable = [
  {
    label: t('Chart Options'),
    expanded: true,
    controlSetRows: [
      [
        'metric',
        'metrics',
        {
          name: 'all_columns',
          config: {
            type: 'SelectControl',
            queryField: 'columns',
            multi: true,
            label: t('Columns'),
            default: [],
            description: t('Columns to display'),
            optionRenderer: c => <ColumnOption column={c} showType />,
            valueRenderer: c => <ColumnOption column={c} />,
            valueKey: 'column_name',
            allowAll: true,
            mapStateToProps: stateRef => ({
              options: stateRef.datasource ? stateRef.datasource.columns : [],
            }),
            commaChoosesOption: false,
            freeForm: true,
          },
        },
      ],
    ],
  },
];

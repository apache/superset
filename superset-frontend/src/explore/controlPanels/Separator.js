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
import { formatSelectOptions } from 'src/modules/utils';

export default {
  controlPanelSections: [
    {
      label: t('Code'),
      controlSetRows: [
        [
          {
            name: 'markup_type',
            config: {
              type: 'SelectControl',
              label: t('Markup Type'),
              clearable: false,
              choices: formatSelectOptions(['markdown', 'html']),
              default: 'markdown',
              validators: [validateNonEmpty],
              description: t('Pick your favorite markup language'),
            },
          },
        ],
        [
          {
            name: 'code',
            config: {
              type: 'TextAreaControl',
              label: t('Code'),
              description: t('Put your code here'),
              mapStateToProps: state => ({
                language:
                  state.controls && state.controls.markup_type
                    ? state.controls.markup_type.value
                    : 'markdown',
              }),
              default: '',
            },
          },
        ],
      ],
    },
  ],
  controlOverrides: {
    code: {
      default:
        '####Section Title\n' +
        'A paragraph describing the section ' +
        'of the dashboard, right before the separator line ' +
        '\n\n' +
        '---------------',
    },
  },
  sectionOverrides: {
    druidTimeSeries: {
      controlSetRows: [],
    },
    sqlaTimeSeries: {
      controlSetRows: [],
    },
  },
};

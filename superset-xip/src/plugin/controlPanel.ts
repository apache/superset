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
import {
  ControlPanelConfig,
  sections,
  sharedControls,
} from '@superset-ui/chart-controls';

const appContainer = document.getElementById('app');
const { user } = JSON.parse(
  appContainer?.getAttribute('data-bootstrap') || '{}'
);

const config: ControlPanelConfig = {
  // For control input types, see: superset-frontend/src/explore/components/controls/index.js
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'all_columns',
            config: {
              ...sharedControls.groupby,
              label: t('Columns'),
              description: t('Columns to query in the database'),
              //validators: [validateNonEmpty],
            },
          },
        ],
        ['adhoc_filters'],
      ],
    },
    {
      label: t('Setup form'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'button_text',
            config: {
              type: 'TextControl',
              default: 'Send',
              renderTrigger: true,
              label: t('Button Text'),
              description: t('The text in the button'),
            },
          },
        ],
        [
          {
            name: 'action_identifier',
            config: {
              type: 'TextControl',
              default: 'PRODUCTIONORDER_STATUS_CHANGE',
              renderTrigger: true,
              label: t('Action identifier'),
              description: t('A unqiue identifier for this form'),
            },
          },
        ],
        [
          {
            name: 'cube_query',
            config: {
              type: 'CheckboxControl',
              label: t('Cube Query'),
              renderTrigger: true,
              default: false,
              description: t(
                'Uses the native cube query instead of the regular query'
              ),
            },
          },
        ],
        [
          {
            name: 'blocking_action',
            config: {
              type: 'CheckboxControl',
              label: t('Blocking action'),
              renderTrigger: true,
              default: true,
              description: t(
                'Makes the dashboard wait for a response from the form'
              ),
            },
          },
        ],
        [
          {
            name: 'form_config',
            config: {
              type: 'TextControl',
              default: '',
              renderTrigger: true,
              label: t('Form Configuration'),
              description: t('Formstructure in JSON format'),
            },
          },
        ],
        // [
        //   {
        //     name: 'datasource',
        //     config: {
        //       type: 'DatasourceControl',
        //       label: t('Datasource'),
        //       default: null,
        //       description: null,
        //       mapStateToProps: ({ datasource, form_data }) => ({
        //         datasource,
        //         form_data,
        //         user,
        //       }),
        //     },
        //   },
        // ],
      ],
    },
  ],
};

export default config;

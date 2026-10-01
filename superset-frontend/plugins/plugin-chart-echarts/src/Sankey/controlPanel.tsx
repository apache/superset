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
import { t } from '@apache-superset/core/translation';
import { validateNonEmpty } from '@superset-ui/core';
import {
  ControlPanelConfig,
  dndGroupByControl,
} from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'source',
            config: {
              ...dndGroupByControl,
              label: t('Source'),
              multi: false,
              description: t(
                'The column to be used as the source of the edge.',
              ),
              validators: [validateNonEmpty],
              freeForm: false,
            },
          },
        ],
        [
          {
            name: 'intermediate_levels',
            config: {
              ...dndGroupByControl,
              label: t('Intermediate levels'),
              multi: true,
              default: [],
              description: t(
                'Optional ordered columns rendered as intermediate stages ' +
                  'between Source and Target. Drag to reorder. When set, ' +
                  'each row flows Source → level 1 → … → Target.',
              ),
              freeForm: false,
            },
          },
        ],
        [
          {
            name: 'target',
            config: {
              ...dndGroupByControl,
              label: t('Target'),
              multi: false,
              description: t(
                'The column to be used as the target of the edge.',
              ),
              validators: [validateNonEmpty],
              freeForm: false,
            },
          },
        ],
        ['metric'],
        ['adhoc_filters'],
        ['row_limit'],
        ['sort_by_metric'],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme'],
        [
          {
            name: 'roam',
            config: {
              type: 'SelectControl',
              label: t('Enable graph roaming'),
              renderTrigger: true,
              default: true,
              choices: [
                [false, t('Disabled')],
                ['scale', t('Scale only')],
                ['move', t('Move only')],
                [true, t('Scale and Move')],
              ],
              description: t(
                'Whether to enable panning and zooming the diagram, which ' +
                  'keeps dense flows readable in a small dashboard tile.',
              ),
            },
          },
        ],
        [
          {
            name: 'node_alignment',
            config: {
              type: 'RadioButtonControl',
              renderTrigger: true,
              label: t('Node alignment'),
              default: 'justify',
              options: [
                ['justify', t('Justify')],
                ['left', t('Left')],
                ['right', t('Right')],
              ],
              description: t(
                'Horizontal alignment of nodes in the diagram. Justify ' +
                  'pushes nodes without outgoing flows to the last level.',
              ),
            },
          },
        ],
      ],
    },
  ],
};

export default config;

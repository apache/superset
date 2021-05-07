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
import { t } from '@superset-ui/core';
import { ControlPanelConfig, sections, sharedControls } from '@superset-ui/chart-controls';
import { DEFAULT_FORM_DATA } from './types';
import { legendSection } from '../controls';

const requiredEntity = {
  ...sharedControls.entity,
  clearable: false,
};

const optionalEntity = {
  ...sharedControls.entity,
  clearable: true,
  validators: [],
};

const controlPanel: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'source',
            config: {
              ...requiredEntity,
              label: t('Source'),
              description: t('Name of the source nodes'),
            },
          },
        ],
        [
          {
            name: 'target',
            config: {
              ...requiredEntity,
              label: t('Target'),
              description: t('Name of the target nodes'),
            },
          },
        ],
        ['metric'],
        [
          {
            name: 'source_category',
            config: {
              ...optionalEntity,
              label: t('Source category'),
              description: t(
                'The category of source nodes used to assign colors. ' +
                  'If a node is associated with more than one category, only the first will be used.',
              ),
            },
          },
        ],
        [
          {
            name: 'target_category',
            config: {
              ...optionalEntity,
              label: t('Target category'),
              description: t('Category of target nodes'),
            },
          },
        ],
        ['adhoc_filters'],
        ['row_limit'],
      ],
    },
    {
      label: t('Chart options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme'],
        ...legendSection,
        [<h1 className="section-header">{t('Layout')}</h1>],
        [
          {
            name: 'layout',
            config: {
              type: 'RadioButtonControl',
              renderTrigger: true,
              label: t('Graph layout'),
              default: DEFAULT_FORM_DATA.layout,
              options: [
                ['force', t('Force')],
                ['circular', t('Circular')],
              ],
              description: t('Layout type of graph'),
            },
          },
        ],
        [
          {
            name: 'edgeSymbol',
            config: {
              type: 'SelectControl',
              renderTrigger: true,
              label: t('Edge symbols'),
              description: t('Symbol of two ends of edge line'),
              default: DEFAULT_FORM_DATA.edgeSymbol,
              choices: [
                ['none,none', t('None -> None')],
                ['none,arrow', t('None -> Arrow')],
                ['circle,arrow', t('Circle -> Arrow')],
                ['circle,circle', t('Circle -> Circle')],
              ],
            },
          },
        ],
        [
          {
            name: 'draggable',
            config: {
              type: 'CheckboxControl',
              label: t('Enable node dragging'),
              renderTrigger: true,
              default: DEFAULT_FORM_DATA.draggable,
              description: t('Whether to enable node dragging in force layout mode.'),
              visibility({ form_data: { layout } }) {
                return layout === 'force' || (!layout && DEFAULT_FORM_DATA.layout === 'force');
              },
            },
          },
        ],
        [
          {
            name: 'roam',
            config: {
              type: 'SelectControl',
              label: t('Enable graph roaming'),
              renderTrigger: true,
              default: DEFAULT_FORM_DATA.roam,
              choices: [
                [false, t('Disabled')],
                ['scale', t('Scale only')],
                ['move', t('Move only')],
                [true, t('Scale and Move')],
              ],
              description: t('Whether to enable changing graph position and scaling.'),
            },
          },
        ],
        [
          {
            name: 'selectedMode',
            config: {
              type: 'SelectControl',
              renderTrigger: true,
              label: t('Node select mode'),
              default: DEFAULT_FORM_DATA.selectedMode,
              choices: [
                [false, t('Disabled')],
                ['single', t('Single')],
                ['multiple', t('Multiple')],
              ],
              description: t('Allow node selections'),
            },
          },
        ],
        [
          {
            name: 'showSymbolThreshold',
            config: {
              type: 'TextControl',
              label: t('Label threshold'),
              renderTrigger: true,
              isInt: true,
              default: DEFAULT_FORM_DATA.showSymbolThreshold,
              description: t('Minimum value for label to be displayed on graph.'),
            },
          },
        ],
        [
          {
            name: 'baseNodeSize',
            config: {
              type: 'TextControl',
              label: t('Node size'),
              renderTrigger: true,
              isFloat: true,
              default: DEFAULT_FORM_DATA.baseNodeSize,
              description: t(
                'Median node size, the largest node will be 4 times larger than the smallest',
              ),
            },
          },
          {
            name: 'baseEdgeWidth',
            config: {
              type: 'TextControl',
              label: t('Edge width'),
              renderTrigger: true,
              isFloat: true,
              default: DEFAULT_FORM_DATA.baseEdgeWidth,
              description: t(
                'Median edge width, the thickest edge will be 4 times thicker than the thinnest.',
              ),
            },
          },
        ],
        [
          {
            name: 'edgeLength',
            config: {
              type: 'SliderControl',
              label: t('Edge length'),
              renderTrigger: true,
              min: 100,
              max: 1000,
              step: 50,
              default: DEFAULT_FORM_DATA.edgeLength,
              description: t('Edge length between nodes'),
              visibility({ form_data: { layout } }) {
                return layout === 'force' || (!layout && DEFAULT_FORM_DATA.layout === 'force');
              },
            },
          },
        ],
        [
          {
            name: 'gravity',
            config: {
              type: 'SliderControl',
              label: t('Gravity'),
              renderTrigger: true,
              min: 0.1,
              max: 1,
              step: 0.1,
              default: DEFAULT_FORM_DATA.gravity,
              description: t('Strength to pull the graph toward center'),
              visibility({ form_data: { layout } }) {
                return layout === 'force' || (!layout && DEFAULT_FORM_DATA.layout === 'force');
              },
            },
          },
        ],
        [
          {
            name: 'repulsion',
            config: {
              type: 'SliderControl',
              label: t('Repulsion'),
              renderTrigger: true,
              min: 100,
              max: 3000,
              step: 50,
              default: DEFAULT_FORM_DATA.repulsion,
              description: t('Repulsion strength between nodes'),
              visibility({ form_data: { layout } }) {
                return layout === 'force' || (!layout && DEFAULT_FORM_DATA.layout === 'force');
              },
            },
          },
        ],
        [
          {
            name: 'friction',
            config: {
              type: 'SliderControl',
              label: t('Friction'),
              renderTrigger: true,
              min: 0.1,
              max: 1,
              step: 0.1,
              default: DEFAULT_FORM_DATA.friction,
              description: t('Friction between nodes'),
              visibility({ form_data: { layout } }) {
                return layout === 'force' || (!layout && DEFAULT_FORM_DATA.layout === 'force');
              },
            },
          },
        ],
      ],
    },
  ],
};

export default controlPanel;

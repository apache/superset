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
  ControlSubSectionHeader,
  getStandardizedControls,
  sharedControls,
} from '@superset-ui/chart-controls';
import { DEFAULT_FORM_DATA } from './constants';

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
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'id',
            config: {
              ...requiredEntity,
              label: t('Id'),
              description: t('Name of the id column'),
            },
          },
        ],
        [
          {
            name: 'parent',
            config: {
              ...requiredEntity,
              label: t('Parent'),
              description: t(
                'Name of the column containing the id of the parent node',
              ),
            },
          },
        ],
        [
          {
            name: 'name',
            config: {
              ...optionalEntity,
              label: t('Name'),
              description: t('Optional name of the data column.'),
            },
          },
        ],
        [
          {
            name: 'root_node_id',
            config: {
              ...optionalEntity,
              renderTrigger: true,
              type: 'TextControl',
              label: t('Root node id'),
              description: t('Id of root node of the tree.'),
            },
          },
        ],
        [
          {
            name: 'metric',
            config: {
              ...optionalEntity,
              type: 'DndMetricSelect',
              label: t('Metric'),
              description: t('Metric for node values'),
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
        [<ControlSubSectionHeader>{t('Layout')}</ControlSubSectionHeader>],
        [
          {
            name: 'layout',
            config: {
              type: 'RadioButtonControl',
              renderTrigger: true,
              label: t('Tree layout'),
              default: DEFAULT_FORM_DATA.layout,
              options: [
                ['orthogonal', t('Orthogonal')],
                ['radial', t('Radial')],
              ],
              description: t('Layout type of tree'),
            },
          },
        ],

        [
          {
            name: 'orient',
            config: {
              type: 'RadioButtonControl',
              renderTrigger: true,
              label: t('Tree orientation'),
              default: DEFAULT_FORM_DATA.orient,
              options: [
                ['LR', t('Left to Right')],
                ['RL', t('Right to Left')],
                ['TB', t('Top to Bottom')],
                ['BT', t('Bottom to Top')],
              ],
              description: t('Orientation of tree'),
              visibility({ form_data: { layout } }) {
                return (layout || DEFAULT_FORM_DATA.layout) === 'orthogonal';
              },
            },
          },
        ],
        [
          {
            name: 'node_label_position',
            config: {
              type: 'RadioButtonControl',
              renderTrigger: true,
              label: t('Node label position'),
              default: DEFAULT_FORM_DATA.nodeLabelPosition,
              options: [
                ['left', t('left')],
                ['top', t('top')],
                ['right', t('right')],
                ['bottom', t('bottom')],
              ],
              description: t('Position of intermediate node label on tree'),
            },
          },
        ],
        [
          {
            name: 'child_label_position',
            config: {
              type: 'RadioButtonControl',
              renderTrigger: true,
              label: t('Child label position'),
              default: DEFAULT_FORM_DATA.childLabelPosition,
              options: [
                ['left', t('left')],
                ['top', t('top')],
                ['right', t('right')],
                ['bottom', t('bottom')],
              ],
              description: t('Position of child node label on tree'),
            },
          },
        ],
        [
          {
            name: 'emphasis',
            config: {
              type: 'RadioButtonControl',
              renderTrigger: true,
              label: t('Emphasis'),
              default: DEFAULT_FORM_DATA.emphasis,
              options: [
                ['ancestor', t('ancestor')],
                ['descendant', t('descendant')],
              ],
              description: t('Which relatives to highlight on hover'),
              visibility({ form_data: { layout } }) {
                return (layout || DEFAULT_FORM_DATA.layout) === 'orthogonal';
              },
            },
          },
        ],
        [
          {
            name: 'symbol',
            config: {
              type: 'SelectControl',
              renderTrigger: true,
              label: t('Symbol'),
              default: DEFAULT_FORM_DATA.symbol,
              options: [
                {
                  label: t('Empty circle'),
                  value: 'emptyCircle',
                },
                {
                  label: t('Circle'),
                  value: 'circle',
                },
                {
                  label: t('Rectangle'),
                  value: 'rect',
                },
                {
                  label: t('Triangle'),
                  value: 'triangle',
                },
                {
                  label: t('Diamond'),
                  value: 'diamond',
                },
                {
                  label: t('Pin'),
                  value: 'pin',
                },
                {
                  label: t('Arrow'),
                  value: 'arrow',
                },
                {
                  label: t('None'),
                  value: 'none',
                },
              ],
              description: t('Layout type of tree'),
            },
          },
        ],
        [
          {
            name: 'symbolSize',
            config: {
              type: 'SliderControl',
              label: t('Symbol size'),
              renderTrigger: true,
              min: 5,
              max: 30,
              step: 2,
              default: DEFAULT_FORM_DATA.symbolSize,
              description: t('Size of edge symbols'),
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
              description: t(
                'Whether to enable changing graph position and scaling.',
              ),
            },
          },
        ],
      ],
    },
  ],
  formDataOverrides: formData => ({
    ...formData,
    metric: getStandardizedControls().shiftMetric(),
  }),
};

export default controlPanel;

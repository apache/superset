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
import { sections, sharedControls, ColumnOption, ColumnMeta } from '@superset-ui/chart-controls';
import { DEFAULT_FORM_DATA, EchartsGraphFormData } from './types';
import {
  legendMarginControl,
  legendOrientationControl,
  legendTypeControl,
  showLegendControl,
} from '../controls';

const noopControl = { name: 'noop', config: { type: '', renderTrigger: true } };
const columnSelectControl = {
  ...sharedControls.entity,
  type: 'SelectControl',
  multi: false,
  freeForm: true,
  default: null,
  includeTime: false,
  optionRenderer: (c: ColumnMeta) => <ColumnOption column={c} showType />,
  valueRenderer: (c: ColumnMeta) => <ColumnOption column={c} />,
  valueKey: 'column_name',
  allowAll: true,
  filterOption: ({ data: opt }: { data: ColumnMeta }, text = '') =>
    opt.column_name?.toLowerCase().includes(text.toLowerCase()) ||
    opt.verbose_name?.toLowerCase().includes(text.toLowerCase()),
  promptTextCreator: (label: string) => label,
  commaChoosesOption: false,
};

export default {
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
              ...columnSelectControl,
              clearable: false,
              label: t('Source'),
              description: t('Name of the source nodes'),
            },
          },
        ],
        [
          {
            name: 'target',
            config: {
              ...columnSelectControl,
              clearable: false,
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
              ...columnSelectControl,
              label: t('Source category'),
              description: t(
                'The category of source nodes used to assign colors. ' +
                  'If a node is associated with more than one category, only the first will be used.',
              ),
              clearable: true,
              validators: [],
            },
          },
        ],
        [
          {
            name: 'target_category',
            config: {
              ...columnSelectControl,
              label: t('Target category'),
              description: t('Category of target nodes'),
              clearable: true,
              validators: [],
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
        [<h1 className="section-header">{t('Legend')}</h1>],
        [showLegendControl],
        [legendTypeControl, legendOrientationControl],
        [legendMarginControl, noopControl],
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
                {
                  label: 'force',
                  value: 'force',
                },
                {
                  label: 'circular',
                  value: 'circular',
                },
              ],
              description: t('Layout type of graph'),
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
              visibility({ form_data: { layout } }: { form_data: EchartsGraphFormData }) {
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
              visibility({ form_data: { layout } }: { form_data: EchartsGraphFormData }) {
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
              visibility({ form_data: { layout } }: { form_data: EchartsGraphFormData }) {
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
              visibility({ form_data: { layout } }: { form_data: EchartsGraphFormData }) {
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
              visibility({ form_data: { layout } }: { form_data: EchartsGraphFormData }) {
                return layout === 'force' || (!layout && DEFAULT_FORM_DATA.layout === 'force');
              },
            },
          },
        ],
      ],
    },
  ],
};

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

import { ControlSubSectionHeader } from '../components/ControlSubSectionHeader';
import { ControlPanelSectionConfig } from '../types';
import { formatSelectOptions } from '../utils';

export const TITLE_MARGIN_OPTIONS: number[] = [
  15, 30, 50, 75, 100, 125, 150, 200,
];
export const TITLE_POSITION_OPTIONS: [string, string][] = [
  ['Left', t('Left')],
  ['Top', t('Top')],
];
export const titleControls: ControlPanelSectionConfig = {
  label: t('Chart Title'),
  tabOverride: 'customize',
  expanded: true,
  controlSetRows: [
    [<ControlSubSectionHeader>{t('X Axis')}</ControlSubSectionHeader>],
    [
      {
        name: 'x_axis_title',
        config: {
          type: 'TextControl',
          label: t('X Axis Title'),
          renderTrigger: true,
          default: '',
          description: t('Changing this control takes effect instantly'),
        },
      },
    ],
    [
      {
        name: 'x_axis_title_margin',
        config: {
          type: 'SelectControl',
          freeForm: true,
          clearable: true,
          label: t('X AXIS TITLE BOTTOM MARGIN'),
          renderTrigger: true,
          default: TITLE_MARGIN_OPTIONS[0],
          choices: formatSelectOptions(TITLE_MARGIN_OPTIONS),
          description: t('Changing this control takes effect instantly'),
        },
      },
    ],
    [<ControlSubSectionHeader>{t('Y Axis')}</ControlSubSectionHeader>],
    [
      {
        name: 'y_axis_title',
        config: {
          type: 'TextControl',
          label: t('Y Axis Title'),
          renderTrigger: true,
          default: '',
          description: t('Changing this control takes effect instantly'),
        },
      },
    ],
    [
      {
        name: 'y_axis_title_margin',
        config: {
          type: 'SelectControl',
          freeForm: true,
          clearable: true,
          label: t('Y Axis Title Margin'),
          renderTrigger: true,
          default: TITLE_MARGIN_OPTIONS[0],
          choices: formatSelectOptions(TITLE_MARGIN_OPTIONS),
          description: t('Changing this control takes effect instantly'),
        },
      },
    ],
    [
      {
        name: 'y_axis_title_position',
        config: {
          type: 'SelectControl',
          freeForm: true,
          clearable: false,
          label: t('Y Axis Title Position'),
          renderTrigger: true,
          default: TITLE_POSITION_OPTIONS[0][0],
          choices: TITLE_POSITION_OPTIONS,
          description: t('Changing this control takes effect instantly'),
        },
      },
    ],
  ],
};

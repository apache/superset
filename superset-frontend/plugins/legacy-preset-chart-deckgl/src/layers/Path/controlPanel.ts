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
import { ControlPanelConfig } from '@superset-ui/chart-controls';
import { t } from '@apache-superset/core/translation';
import {
  filterNulls,
  autozoom,
  jsColumns,
  jsDataMutator,
  jsTooltip,
  jsOnclickHref,
  viewport,
  lineType,
  reverseLongLat,
  mapboxStyle,
  tooltipContents,
  tooltipTemplate,
  pathLineWidthFixedOrMetric,
  generateDeckGLColorSchemeControls,
} from '../../utilities/Shared_DeckGL';
import { dndLineColumn } from '../../utilities/sharedDndControls';
import { validateNonEmpty } from '@superset-ui/core';
import { COLOR_SCHEME_TYPES } from '../../utilities/utils';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [dndLineColumn],
        [
          {
            ...lineType,
            config: {
              ...lineType.config,
              choices: [
                ['polyline', t('Polyline')],
                ['json', t('JSON')],
              ],
            },
          },
        ],
        ['row_limit'],
        [filterNulls],
        ['adhoc_filters'],
        [tooltipContents],
        [tooltipTemplate],
      ],
    },
    {
      label: t('Map'),
      expanded: true,
      controlSetRows: [[mapboxStyle], [viewport], [reverseLongLat], [autozoom]],
    },
    {
      label: t('Path Size'),
      expanded: true,
      controlSetRows: [
        [pathLineWidthFixedOrMetric],
        [
          {
            name: 'line_width_unit',
            config: {
              type: 'SelectControl',
              label: t('Line width unit'),
              default: 'pixels',
              choices: [
                ['meters', t('meters')],
                ['pixels', t('pixels')],
              ],
            },
          },
        ],
        [
          {
            name: 'min_width',
            config: {
              type: 'TextControl',
              label: t('Minimum Width'),
              isFloat: true,
              validators: [validateNonEmpty],
              renderTrigger: true,
              default: 1,
              description: t(
                'Minimum width size of the path, in pixels or meters.',
              ),
            },
          },
          {
            name: 'max_width',
            config: {
              type: 'TextControl',
              label: t('Maximum Width'),
              isFloat: true,
              validators: [validateNonEmpty],
              renderTrigger: true,
              default: 20,
              description: t(
                'Maximum width size of the path, in pixels or meters.',
              ),
            },
          },
        ],
        [
          {
            name: 'line_width_multiplier',
            config: {
              type: 'TextControl',
              label: t('Width scale multiplier'),
              renderTrigger: true,
              isFloat: true,
              default: 1,
              description: t(
                'Scale factor applied to metric-driven line widths',
              ),
            },
          },
        ],
      ],
    },
    {
      label: t('Path Color'),
      expanded: true,
      controlSetRows: [
        ...generateDeckGLColorSchemeControls({
          defaultSchemeType: COLOR_SCHEME_TYPES.fixed_color,
        }),
      ],
    },
    {
      label: t('Advanced'),
      controlSetRows: [
        [jsColumns],
        //[jsDataMutator], // TODO: uncomment
        [jsTooltip],
        [jsOnclickHref],
      ],
    },
  ],
};

export default config;

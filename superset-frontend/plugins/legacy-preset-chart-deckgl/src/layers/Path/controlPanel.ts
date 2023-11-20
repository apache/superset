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
import { ControlPanelConfig, sections } from '@superset-ui/chart-controls';
import { FeatureFlag, isFeatureEnabled, t } from '@superset-ui/core';
import {
  filterNulls,
  autozoom,
  jsColumns,
  jsDataMutator,
  jsTooltip,
  jsOnclickHref,
  lineColumn,
  viewport,
  lineWidth,
  lineType,
  reverseLongLat,
  mapboxStyle,
} from '../../utilities/Shared_DeckGL';
import { dndLineColumn } from '../../utilities/sharedDndControls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          isFeatureEnabled(FeatureFlag.ENABLE_EXPLORE_DRAG_AND_DROP)
            ? dndLineColumn
            : lineColumn,
        ],
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
      ],
    },
    {
      label: t('Map'),
      expanded: true,
      controlSetRows: [
        [mapboxStyle],
        [viewport],
        ['color_picker'],
        [lineWidth],
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
              renderTrigger: true,
            },
          },
        ],
        [reverseLongLat],
        [autozoom],
      ],
    },
    {
      label: t('Advanced'),
      controlSetRows: [
        [jsColumns],
        [jsDataMutator],
        [jsTooltip],
        [jsOnclickHref],
      ],
    },
  ],
};

export default config;

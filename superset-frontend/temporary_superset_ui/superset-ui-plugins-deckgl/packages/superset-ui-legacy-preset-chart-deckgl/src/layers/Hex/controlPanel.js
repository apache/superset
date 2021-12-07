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
import { sections } from '@superset-ui/chart-controls';
import { t } from '@superset-ui/core';
import { formatSelectOptions } from '../../utilities/utils';
import {
  autozoom,
  extruded,
  filterNulls,
  gridSize,
  jsColumns,
  jsDataMutator,
  jsOnclickHref,
  jsTooltip,
  mapboxStyle,
  spatial,
  viewport,
} from '../../utilities/Shared_DeckGL';

export default {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [[spatial], ['size'], ['row_limit'], [filterNulls], ['adhoc_filters']],
    },
    {
      label: t('Map'),
      controlSetRows: [
        [mapboxStyle, viewport],
        ['color_picker'],
        [autozoom],
        [gridSize],
        [extruded],
        [
          {
            name: 'js_agg_function',
            config: {
              type: 'SelectControl',
              label: t('Dynamic Aggregation Function'),
              description: t('The function to use when aggregating points into groups'),
              default: 'sum',
              clearable: false,
              renderTrigger: true,
              choices: formatSelectOptions([
                'sum',
                'min',
                'max',
                'mean',
                'median',
                'count',
                'variance',
                'deviation',
                'p1',
                'p5',
                'p95',
                'p99',
              ]),
            },
          },
        ],
      ],
    },
    {
      label: t('Advanced'),
      controlSetRows: [[jsColumns], [jsDataMutator], [jsTooltip], [jsOnclickHref]],
    },
  ],
};

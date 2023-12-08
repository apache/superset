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
import {
  ControlPanelConfig,
  getStandardizedControls,
  sections,
} from '@superset-ui/chart-controls';
import { t, validateNonEmpty } from '@superset-ui/core';
import {
  autozoom,
  filterNulls,
  jsColumns,
  jsDataMutator,
  jsOnclickHref,
  jsTooltip,
  mapboxStyle,
  spatial,
  viewport,
} from '../../utilities/Shared_DeckGL';

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [spatial],
        ['row_limit'],
        ['size'],
        [filterNulls],
        ['adhoc_filters'],
      ],
    },
    {
      label: t('Map'),
      expanded: true,
      controlSetRows: [
        [mapboxStyle],
        [autozoom, viewport],
        [
          {
            name: 'cellSize',
            config: {
              type: 'TextControl',
              label: t('Cell Size'),
              default: 300,
              isInt: true,
              description: t('The size of each cell in meters'),
              renderTrigger: true,
              clearable: false,
            },
          },
        ],
        [
          {
            name: 'aggregation',
            config: {
              type: 'SelectControl',
              label: t('Aggregation'),
              description: t(
                'The function to use when aggregating points into groups',
              ),
              default: 'sum',
              clearable: false,
              renderTrigger: true,
              choices: [
                ['sum', t('sum')],
                ['min', t('min')],
                ['max', t('max')],
                ['mean', t('mean')],
              ],
            },
          },
        ],
        [
          {
            name: 'contours',
            config: {
              type: 'ContourControl',
              label: t('Contours'),
              renderTrigger: true,
              description: t(
                'Define contour layers. Isolines represent a collection of line segments that ' +
                  'serparate the area above and below a given threshold. Isobands represent a ' +
                  'collection of polygons that fill the are containing values in a given ' +
                  'threshold range.',
              ),
            },
          },
        ],
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
  controlOverrides: {
    size: {
      label: t('Weight'),
      description: t("Metric used as a weight for the grid's coloring"),
      validators: [validateNonEmpty],
    },
  },
  formDataOverrides: formData => ({
    ...formData,
    size: getStandardizedControls().shiftMetric(),
  }),
};

export default config;

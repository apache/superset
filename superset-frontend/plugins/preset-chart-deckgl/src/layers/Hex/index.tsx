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
import { Behavior } from '@superset-ui/core';
import { getStandardizedControls } from '@superset-ui/chart-controls';
import { defineChart } from '@superset-ui/glyph-core';
import HexComponent from './Hex';
import {
  SpatialFormData,
  buildSpatialQuery,
  transformSpatialProps,
} from '../spatialUtils';
import {
  autozoom,
  extruded,
  filterNulls,
  generateDeckGLColorSchemeControls,
  gridSize,
  jsColumns,
  jsDataMutator,
  jsOnclickHref,
  jsTooltip,
  mapboxStyle,
  maplibreStyle,
  mapProvider,
  spatial,
  viewport,
  tooltipContents,
  tooltipTemplate,
} from '../../utilities/Shared_DeckGL';
import { COLOR_SCHEME_TYPES } from '../../utilities/utils';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example from './images/example.png';
import exampleDark from './images/example-dark.png';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DeckHexFormData extends SpatialFormData {
  extruded?: boolean;
  js_agg_function?: string;
  grid_size?: number;
}

// ─── Plugin definition ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineChart<Record<string, never>, any>({
  metadata: {
    name: t('deck.gl 3D Hexagon'),
    description: t(
      'Overlays a hexagonal grid on a map, and aggregates data within the boundary of each cell.',
    ),
    category: t('Map'),
    credits: ['https://uber.github.io/deck.gl'],
    behaviors: [Behavior.InteractiveChart],
    tags: [t('deckGL'), t('3D'), t('Geo'), t('Comparison')],
    thumbnail,
    thumbnailDark,
    exampleGallery: [{ url: example, urlDark: exampleDark }],
  },
  arguments: {},
  suppressQuerySection: true,
  prependSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [spatial],
        ['size'],
        ['row_limit'],
        [filterNulls],
        ['adhoc_filters'],
        [tooltipContents],
        [tooltipTemplate],
      ],
    },
    {
      label: t('Map'),
      controlSetRows: [
        [mapProvider],
        [mapboxStyle],
        [maplibreStyle],
        ...generateDeckGLColorSchemeControls({
          defaultSchemeType: COLOR_SCHEME_TYPES.categorical_palette,
          disableCategoricalColumn: true,
        }),
        [viewport],
        [autozoom],
        [gridSize],
        [extruded],
        [
          {
            name: 'js_agg_function',
            config: {
              type: 'SelectControl',
              label: t('Dynamic Aggregation Function'),
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
                ['median', t('median')],
                ['count', t('count')],
                ['variance', t('variance')],
                ['deviation', t('deviation')],
                ['p1', t('p1')],
                ['p5', t('p5')],
                ['p95', t('p95')],
                ['p99', t('p99')],
              ],
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
  formDataOverrides: formData => ({
    ...formData,
    size: getStandardizedControls().shiftMetric(),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildQuery: (formData: any) => buildSpatialQuery(formData as DeckHexFormData),
  transform: chartProps => transformSpatialProps(chartProps),
  render: props => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <HexComponent {...(props as any)} />
  ),
});

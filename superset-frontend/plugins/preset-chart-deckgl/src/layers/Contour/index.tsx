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
import { Behavior, validateNonEmpty } from '@superset-ui/core';
import { getStandardizedControls } from '@superset-ui/chart-controls';
import { defineChart } from '@superset-ui/glyph-core';
import ContourComponent from './Contour';
import {
  SpatialFormData,
  buildSpatialQuery,
  transformSpatialProps,
} from '../spatialUtils';
import {
  autozoom,
  filterNulls,
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
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example from './images/example.png';
import exampleDark from './images/example-dark.png';

export { getSafeCellSize } from './getSafeCellSize';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DeckContourFormData extends SpatialFormData {
  cellSize?: string;
  aggregation?: string;
  contours?: Array<{
    color: { r: number; g: number; b: number };
    lowerThreshold: number;
    upperThreshold?: number;
    strokeWidth?: number;
  }>;
}

// ─── Plugin definition ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineChart<Record<string, never>, any>({
  metadata: {
    name: t('deck.gl Contour'),
    description: t(
      'Uses Gaussian Kernel Density Estimation to visualize spatial distribution of data',
    ),
    category: t('Map'),
    credits: ['https://uber.github.io/deck.gl'],
    behaviors: [Behavior.InteractiveChart],
    tags: [t('deckGL'), t('Spatial'), t('Comparison')],
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
        ['row_limit'],
        ['size'],
        [filterNulls],
        ['adhoc_filters'],
        [tooltipContents],
        [tooltipTemplate],
      ],
    },
    {
      label: t('Map'),
      expanded: true,
      controlSetRows: [
        [mapProvider],
        [mapboxStyle],
        [maplibreStyle],
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
  additionalControlOverrides: {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildQuery: (formData: any) =>
    buildSpatialQuery(formData as DeckContourFormData),
  transform: chartProps => transformSpatialProps(chartProps),
  render: props => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <ContourComponent {...(props as any)} />
  ),
});

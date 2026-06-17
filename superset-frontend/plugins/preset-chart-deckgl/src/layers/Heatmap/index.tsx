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
import {
  Behavior,
  legacyValidateInteger,
  legacyValidateNumber,
  validateNonEmpty,
} from '@superset-ui/core';
import { formatSelectOptions } from '@superset-ui/chart-controls';
import { defineChart } from '@superset-ui/glyph-core';
import HeatmapComponent from './Heatmap';
import {
  SpatialFormData,
  buildSpatialQuery,
  transformSpatialProps,
} from '../spatialUtils';
import {
  autozoom,
  deckGLCategoricalColorSchemeTypeSelect,
  deckGLFixedColor,
  deckGLLinearColorSchemeSelect,
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
import { COLOR_SCHEME_TYPES } from '../../utilities/utils';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example from './images/example.png';
import exampleDark from './images/example-dark.png';

const INTENSITY_OPTIONS = Array.from(
  { length: 10 },
  (_, index) => (index + 1) / 10,
);
const RADIUS_PIXEL_OPTIONS = Array.from(
  { length: 14 },
  (_, index) => index * 5 + 5,
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineChart<Record<string, never>, any>({
  metadata: {
    name: t('deck.gl Heatmap'),
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
        ['size'],
        ['row_limit'],
        [filterNulls],
        ['adhoc_filters'],
        [tooltipContents],
        [tooltipTemplate],
        [
          {
            name: 'intensity',
            config: {
              type: 'SelectControl',
              label: t('Intensity'),
              description: t(
                'Intensity is the value multiplied by the weight to obtain the final weight',
              ),
              freeForm: true,
              clearable: false,
              validators: [legacyValidateNumber],
              default: 1,
              choices: formatSelectOptions(INTENSITY_OPTIONS),
            },
          },
        ],
        [
          {
            name: 'radius_pixels',
            config: {
              type: 'SelectControl',
              label: t('Intensity Radius'),
              description: t(
                'Intensity Radius is the radius at which the weight is distributed',
              ),
              freeForm: true,
              clearable: false,
              validators: [legacyValidateInteger],
              default: 30,
              choices: formatSelectOptions(RADIUS_PIXEL_OPTIONS),
            },
          },
        ],
      ],
    },
    {
      label: t('Map'),
      controlSetRows: [
        [mapProvider],
        [mapboxStyle],
        [maplibreStyle],
        [viewport],
        [
          {
            name: 'color_scheme_type',
            config: {
              ...deckGLCategoricalColorSchemeTypeSelect.config,
              choices: [
                [COLOR_SCHEME_TYPES.fixed_color, t('Fixed color')],
                [COLOR_SCHEME_TYPES.linear_palette, t('Linear palette')],
              ],
              default: COLOR_SCHEME_TYPES.linear_palette,
            },
          },
        ],
        [deckGLFixedColor],
        [deckGLLinearColorSchemeSelect],
        [autozoom],
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
                ['mean', t('mean')],
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
  additionalControlOverrides: {
    size: {
      label: t('Weight'),
      description: t("Metric used as a weight for the grid's coloring"),
      validators: [validateNonEmpty],
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildQuery: (formData: any) => buildSpatialQuery(formData as SpatialFormData),
  transform: chartProps => transformSpatialProps(chartProps),
  render: props => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <HeatmapComponent {...(props as any)} />
  ),
});

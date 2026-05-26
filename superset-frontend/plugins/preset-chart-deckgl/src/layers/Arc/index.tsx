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
  buildQueryContext,
  ChartProps,
  ensureIsArray,
  legacyValidateInteger,
  SqlaFormData,
  validateNonEmpty,
} from '@superset-ui/core';
import { defineChart } from '@superset-ui/glyph-core';
import ArcComponent from './Arc';
import {
  processSpatialData,
  addJsColumnsToExtraProps,
  DataRecord,
  getSpatialColumns,
  addSpatialNullFilters,
  SpatialFormData,
} from '../spatialUtils';
import {
  createBaseTransformResult,
  getRecordsFromQuery,
  addPropertiesToFeature,
} from '../transformUtils';
import { addTooltipColumnsToQuery } from '../buildQueryUtils';
import timeGrainSqlaAnimationOverrides, {
  columnChoices,
  PRIMARY_COLOR,
} from '../../utilities/controls';
import {
  COLOR_SCHEME_TYPES,
  formatSelectOptions,
  isColorSchemeTypeVisible,
} from '../../utilities/utils';
import {
  filterNulls,
  autozoom,
  jsColumns,
  jsDataMutator,
  jsTooltip,
  jsOnclickHref,
  legendFormat,
  legendPosition,
  viewport,
  mapboxStyle,
  maplibreStyle,
  mapProvider,
  tooltipContents,
  tooltipTemplate,
  deckGLCategoricalColor,
  deckGLCategoricalColorSchemeSelect,
  deckGLCategoricalColorSchemeTypeSelect,
} from '../../utilities/Shared_DeckGL';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example from './images/example.png';
import exampleDark from './images/example-dark.png';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DeckArcFormData extends SqlaFormData {
  start_spatial: SpatialFormData['spatial'];
  end_spatial: SpatialFormData['spatial'];
  dimension?: string;
  js_columns?: string[];
  tooltip_contents?: unknown[];
  tooltip_template?: string;
}

interface ArcPoint {
  sourcePosition: [number, number];
  targetPosition: [number, number];
  cat_color?: string;
  __timestamp?: number;
  extraProps?: Record<string, unknown>;
  [key: string]: unknown;
}

// ─── buildQuery ──────────────────────────────────────────────────────────────

export function buildQuery(formData: DeckArcFormData) {
  const {
    start_spatial,
    end_spatial,
    dimension,
    js_columns,
    tooltip_contents,
  } = formData;

  if (!start_spatial || !end_spatial) {
    throw new Error(
      'Start and end spatial configurations are required for Arc charts',
    );
  }

  return buildQueryContext(formData, baseQueryObject => {
    const startSpatialColumns = getSpatialColumns(start_spatial);
    const endSpatialColumns = getSpatialColumns(end_spatial);

    let columns = [
      ...(baseQueryObject.columns || []),
      ...startSpatialColumns,
      ...endSpatialColumns,
    ];

    if (dimension) {
      columns = [...columns, dimension];
    }

    const jsCols = ensureIsArray(js_columns || []);
    jsCols.forEach(col => {
      if (!columns.includes(col)) {
        columns.push(col);
      }
    });

    columns = addTooltipColumnsToQuery(columns, tooltip_contents);

    let filters = addSpatialNullFilters(
      start_spatial,
      ensureIsArray(baseQueryObject.filters || []),
    );
    filters = addSpatialNullFilters(end_spatial, filters);

    const isTimeseries = !!formData.time_grain_sqla;

    return [
      {
        ...baseQueryObject,
        columns,
        filters,
        is_timeseries: isTimeseries,
        row_limit: baseQueryObject.row_limit,
      },
    ];
  });
}

// ─── transformProps ──────────────────────────────────────────────────────────

export function processArcData(
  records: DataRecord[],
  startSpatial: DeckArcFormData['start_spatial'],
  endSpatial: DeckArcFormData['end_spatial'],
  dimension?: string,
  jsCols?: string[],
): ArcPoint[] {
  if (!startSpatial || !endSpatial || !records.length) {
    return [];
  }

  const startFeatures = processSpatialData(records, startSpatial);
  const endFeatures = processSpatialData(records, endSpatial);
  const excludeKeys = new Set(
    ['__timestamp', dimension, ...(jsCols || [])].filter(
      (key): key is string => key != null,
    ),
  );

  return records
    .map((record, index) => {
      const startFeature = startFeatures[index];
      const endFeature = endFeatures[index];

      if (!startFeature || !endFeature) {
        return null;
      }

      let arcPoint: ArcPoint = {
        sourcePosition: startFeature.position,
        targetPosition: endFeature.position,
        extraProps: {},
      };

      arcPoint = addJsColumnsToExtraProps(arcPoint, record, jsCols);

      if (dimension && record[dimension] != null) {
        arcPoint.cat_color = String(record[dimension]);
      }

      // eslint-disable-next-line no-underscore-dangle
      if (record.__timestamp != null) {
        // eslint-disable-next-line no-underscore-dangle
        arcPoint.__timestamp = Number(record.__timestamp);
      }

      arcPoint = addPropertiesToFeature(arcPoint, record, excludeKeys);
      return arcPoint;
    })
    .filter((point): point is ArcPoint => point !== null);
}

function transformProps(chartProps: ChartProps) {
  const { rawFormData: formData } = chartProps;
  const { start_spatial, end_spatial, dimension, js_columns } =
    formData as DeckArcFormData;

  const records = getRecordsFromQuery(chartProps.queriesData);
  const features = processArcData(
    records,
    start_spatial,
    end_spatial,
    dimension,
    js_columns,
  );

  return createBaseTransformResult(chartProps, features);
}

// ─── Plugin definition ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineChart<Record<string, never>, any>({
  metadata: {
    name: t('deck.gl Arc'),
    description: t(
      'Plot the distance (like flight paths) between origin and destination.',
    ),
    category: t('Map'),
    credits: ['https://uber.github.io/deck.gl'],
    behaviors: [
      Behavior.InteractiveChart,
      Behavior.DrillBy,
      Behavior.DrillToDetail,
    ],
    tags: [t('deckGL'), t('Geo'), t('3D'), t('Relational'), t('Web')],
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
        [
          {
            name: 'start_spatial',
            config: {
              type: 'SpatialControl',
              label: t('Start Longitude & Latitude'),
              validators: [validateNonEmpty],
              description: t('Point to your spatial columns'),
              mapStateToProps: state => ({
                choices: columnChoices(state.datasource),
              }),
            },
          },
          {
            name: 'end_spatial',
            config: {
              type: 'SpatialControl',
              label: t('End Longitude & Latitude'),
              validators: [validateNonEmpty],
              description: t('Point to your spatial columns'),
              mapStateToProps: state => ({
                choices: columnChoices(state.datasource),
              }),
            },
          },
        ],
        ['row_limit', filterNulls],
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
        [autozoom, viewport],
      ],
    },
    {
      label: t('Arc'),
      controlSetRows: [
        [
          {
            name: 'color_scheme_type',
            config: {
              ...deckGLCategoricalColorSchemeTypeSelect.config,
              choices: [
                [COLOR_SCHEME_TYPES.fixed_color, t('Fixed color')],
                [
                  COLOR_SCHEME_TYPES.categorical_palette,
                  t('Categorical palette'),
                ],
              ],
              default: COLOR_SCHEME_TYPES.fixed_color,
            },
          },
        ],
        [
          {
            name: 'color_picker',
            config: {
              label: t('Source Color'),
              description: t('Color of the source location'),
              type: 'ColorPickerControl',
              default: PRIMARY_COLOR,
              renderTrigger: true,
              visibility: ({ controls }) =>
                isColorSchemeTypeVisible(
                  controls,
                  COLOR_SCHEME_TYPES.fixed_color,
                ),
            },
          },
          {
            name: 'target_color_picker',
            config: {
              label: t('Target Color'),
              description: t('Color of the target location'),
              type: 'ColorPickerControl',
              default: PRIMARY_COLOR,
              renderTrigger: true,
              visibility: ({ controls }) =>
                isColorSchemeTypeVisible(
                  controls,
                  COLOR_SCHEME_TYPES.fixed_color,
                ),
            },
          },
        ],
        [deckGLCategoricalColor],
        [deckGLCategoricalColorSchemeSelect],
        [
          {
            name: 'stroke_width',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Stroke Width'),
              validators: [legacyValidateInteger],
              default: null,
              renderTrigger: true,
              choices: formatSelectOptions([1, 2, 3, 4, 5]),
            },
          },
        ],
        [legendPosition],
        [legendFormat],
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
      validators: [],
    },
    time_grain_sqla: timeGrainSqlaAnimationOverrides,
  },
  buildQuery: (formData: any) => buildQuery(formData as DeckArcFormData),
  transform: chartProps => transformProps(chartProps),
  render: props => <ArcComponent {...(props as any)} />,
});

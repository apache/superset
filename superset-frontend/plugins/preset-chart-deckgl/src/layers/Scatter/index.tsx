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
  getMetricLabel,
  QueryFormColumn,
  QueryFormMetric,
  QueryFormOrderBy,
  QueryObject,
  SqlaFormData,
  validateNonEmpty,
} from '@superset-ui/core';
import { defineChart } from '@superset-ui/glyph-core';
import ScatterComponent from './Scatter';
import {
  processSpatialData,
  getSpatialColumns,
  addSpatialNullFilters,
  SpatialFormData,
  DataRecord,
} from '../spatialUtils';
import {
  createBaseTransformResult,
  getRecordsFromQuery,
  getMetricLabelFromFormData,
  parseMetricValue,
  addPropertiesToFeature,
} from '../transformUtils';
import {
  addJsColumnsToColumns,
  addTooltipColumnsToQuery,
} from '../buildQueryUtils';
import {
  isMetricValue,
  isFixedValue,
  getFixedValue,
} from '../utils/metricUtils';
import timeGrainSqlaAnimationOverrides from '../../utilities/controls';
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
  spatial,
  pointRadiusFixed,
  multiplier,
  mapboxStyle,
  maplibreStyle,
  mapProvider,
  generateDeckGLColorSchemeControls,
  tooltipContents,
  tooltipTemplate,
} from '../../utilities/Shared_DeckGL';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example from './images/example.png';
import exampleDark from './images/example-dark.png';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DeckScatterFormData
  extends Omit<SpatialFormData, 'color_picker'>, SqlaFormData {
  // Can be a string (legacy format) or an object with type and value
  point_radius_fixed?:
    | string // Legacy format: metric name directly
    | {
        type?: 'fix' | 'metric';
        value?: QueryFormMetric | number;
      };
  multiplier?: number;
  point_unit?: string;
  min_radius?: number;
  max_radius?: number;
  color_picker?: { r: number; g: number; b: number; a: number };
  dimension?: string;
}

interface ScatterPoint {
  position: [number, number];
  radius?: number;
  color?: [number, number, number, number];
  cat_color?: string;
  metric?: number;
  extraProps?: Record<string, unknown>;
  [key: string]: unknown;
}

// ─── buildQuery ──────────────────────────────────────────────────────────────

export function buildQuery(formData: DeckScatterFormData) {
  const {
    spatial: spatialCfg,
    point_radius_fixed,
    dimension,
    js_columns,
    tooltip_contents,
  } = formData;

  if (!spatialCfg) {
    throw new Error('Spatial configuration is required for Scatter charts');
  }

  return buildQueryContext(formData, {
    buildQuery: (baseQueryObject: QueryObject) => {
      const spatialColumns = getSpatialColumns(spatialCfg);
      let columns = [...(baseQueryObject.columns || []), ...spatialColumns];

      if (dimension) {
        columns.push(dimension);
      }

      const columnStrings = columns.map(col =>
        typeof col === 'string' ? col : col.label || col.sqlExpression || '',
      );
      const withJsColumns = addJsColumnsToColumns(columnStrings, js_columns);

      columns = withJsColumns as QueryFormColumn[];
      columns = addTooltipColumnsToQuery(columns, tooltip_contents);

      const isMetric = isMetricValue(point_radius_fixed);
      const rawValue =
        typeof point_radius_fixed === 'string'
          ? point_radius_fixed
          : point_radius_fixed?.value;
      const metricValue: QueryFormMetric | null =
        isMetric && rawValue !== undefined && typeof rawValue !== 'number'
          ? (rawValue as QueryFormMetric)
          : null;

      const existingMetrics = baseQueryObject.metrics || [];
      const existingLabels = new Set(
        existingMetrics.map(m => getMetricLabel(m)),
      );
      const metrics: QueryFormMetric[] =
        metricValue && !existingLabels.has(getMetricLabel(metricValue))
          ? [...existingMetrics, metricValue]
          : existingMetrics;

      const filters = addSpatialNullFilters(
        spatialCfg,
        ensureIsArray(baseQueryObject.filters || []),
      );

      const orderby =
        isMetric && metricValue
          ? ([[getMetricLabel(metricValue), false]] as QueryFormOrderBy[])
          : (baseQueryObject.orderby as QueryFormOrderBy[]) || [];

      return [
        {
          ...baseQueryObject,
          columns,
          metrics,
          filters,
          orderby,
          is_timeseries: false,
          row_limit: baseQueryObject.row_limit,
        },
      ];
    },
  });
}

// ─── transformProps ──────────────────────────────────────────────────────────

export function processScatterData(
  records: DataRecord[],
  spatialCfg: DeckScatterFormData['spatial'],
  radiusMetricLabel?: string,
  categoryColumn?: string,
  jsCols?: string[],
  fixedRadiusValue?: number | string | null,
): ScatterPoint[] {
  if (!spatialCfg || !records.length) {
    return [];
  }

  const spatialFeatures = processSpatialData(records, spatialCfg);
  const excludeKeys = new Set([
    'position',
    'weight',
    'extraProps',
    ...(spatialCfg
      ? [
          spatialCfg.lonCol,
          spatialCfg.latCol,
          spatialCfg.lonlatCol,
          spatialCfg.geohashCol,
        ].filter(Boolean)
      : []),
    radiusMetricLabel,
    categoryColumn,
    ...(jsCols || []),
  ]);

  return spatialFeatures.map(feature => {
    let scatterPoint: ScatterPoint = {
      position: feature.position,
      extraProps: feature.extraProps || {},
    };

    if (fixedRadiusValue != null) {
      const parsedFixedRadius = parseMetricValue(fixedRadiusValue);
      if (parsedFixedRadius !== undefined) {
        scatterPoint.radius = parsedFixedRadius;
      }
    } else if (radiusMetricLabel && feature[radiusMetricLabel] != null) {
      const radiusValue = parseMetricValue(feature[radiusMetricLabel]);
      if (radiusValue !== undefined) {
        scatterPoint.radius = radiusValue;
        scatterPoint.metric = radiusValue;
      }
    }

    if (categoryColumn && feature[categoryColumn] != null) {
      scatterPoint.cat_color = String(feature[categoryColumn]);
    }

    scatterPoint = addPropertiesToFeature(
      scatterPoint,
      feature as DataRecord,
      excludeKeys,
    );
    return scatterPoint;
  });
}

export function transformProps(chartProps: ChartProps) {
  const { rawFormData: formData } = chartProps;
  const {
    spatial: spatialCfg,
    point_radius_fixed,
    dimension,
    js_columns,
  } = formData as DeckScatterFormData;

  const fixedRadiusValue = isFixedValue(point_radius_fixed)
    ? getFixedValue(point_radius_fixed)
    : null;

  const radiusMetricLabel = getMetricLabelFromFormData(point_radius_fixed);
  const records = getRecordsFromQuery(chartProps.queriesData);

  const features = processScatterData(
    records,
    spatialCfg,
    radiusMetricLabel,
    dimension,
    js_columns,
    fixedRadiusValue,
  );

  return createBaseTransformResult(
    chartProps,
    features,
    radiusMetricLabel ? [radiusMetricLabel] : [],
  );
}

// ─── Plugin definition ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineChart<Record<string, never>, any>({
  metadata: {
    name: t('deck.gl Scatterplot'),
    description: t(
      'A map that takes rendering circles with a variable radius at latitude/longitude coordinates',
    ),
    category: t('Map'),
    credits: ['https://uber.github.io/deck.gl'],
    behaviors: [Behavior.InteractiveChart],
    tags: [
      t('deckGL'),
      t('Comparison'),
      t('Scatter'),
      t('2D'),
      t('Geo'),
      t('Intensity'),
      t('Density'),
    ],
    thumbnail,
    thumbnailDark,
    exampleGallery: [{ url: example, urlDark: exampleDark }],
  },
  arguments: {},
  suppressQuerySection: true,
  onInit: controlState => ({
    ...controlState,
    time_grain_sqla: {
      ...controlState.time_grain_sqla,
      value: null,
    },
    granularity: {
      ...controlState.granularity,
      value: null,
    },
  }),
  prependSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [spatial, null],
        ['row_limit', filterNulls],
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
      ],
    },
    {
      label: t('Point Size'),
      controlSetRows: [
        [pointRadiusFixed],
        [
          {
            name: 'point_unit',
            config: {
              type: 'SelectControl',
              label: t('Point Unit'),
              default: 'square_m',
              clearable: false,
              choices: [
                ['square_m', t('Square meters')],
                ['square_km', t('Square kilometers')],
                ['square_miles', t('Square miles')],
                ['radius_m', t('Radius in meters')],
                ['radius_km', t('Radius in kilometers')],
                ['radius_miles', t('Radius in miles')],
              ],
              description: t(
                'The unit of measure for the specified point radius',
              ),
            },
          },
        ],
        [
          {
            name: 'min_radius',
            config: {
              type: 'TextControl',
              label: t('Minimum Radius'),
              isFloat: true,
              validators: [validateNonEmpty],
              renderTrigger: true,
              default: 2,
              description: t(
                'Minimum radius size of the circle, in pixels. As the zoom level changes, this ' +
                  'insures that the circle respects this minimum radius.',
              ),
            },
          },
          {
            name: 'max_radius',
            config: {
              type: 'TextControl',
              label: t('Maximum Radius'),
              isFloat: true,
              validators: [validateNonEmpty],
              renderTrigger: true,
              default: 250,
              description: t(
                'Maximum radius size of the circle, in pixels. As the zoom level changes, this ' +
                  'insures that the circle respects this maximum radius.',
              ),
            },
          },
        ],
        [multiplier, null],
      ],
    },
    {
      label: t('Point Color'),
      controlSetRows: [
        [legendPosition],
        [legendFormat],
        ...generateDeckGLColorSchemeControls({}),
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildQuery: (formData: any) => buildQuery(formData as DeckScatterFormData),
  transform: chartProps => transformProps(chartProps),
  render: props => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <ScatterComponent {...(props as any)} />
  ),
});

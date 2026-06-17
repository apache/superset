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
  QueryObject,
  QueryObjectFilterClause,
  SqlaFormData,
} from '@superset-ui/core';
import { getStandardizedControls } from '@superset-ui/chart-controls';
import { defineChart } from '@superset-ui/glyph-core';
import { decode_bbox } from 'ngeohash';
import PolygonComponent from './Polygon';
import { addJsColumnsToExtraProps, DataRecord } from '../spatialUtils';
import {
  createBaseTransformResult,
  getRecordsFromQuery,
  getMetricLabelFromFormData,
  parseMetricValue,
  addPropertiesToFeature,
} from '../transformUtils';
import { addTooltipColumnsToQuery } from '../buildQueryUtils';
import timeGrainSqlaAnimationOverrides from '../../utilities/controls';
import { COLOR_SCHEME_TYPES, formatSelectOptions } from '../../utilities/utils';
import {
  filterNulls,
  autozoom,
  jsColumns,
  jsDataMutator,
  jsTooltip,
  jsOnclickHref,
  crossFilterColumn,
  legendFormat,
  legendPosition,
  fillColorPicker,
  strokeColorPicker,
  filled,
  stroked,
  extruded,
  viewport,
  pointRadiusFixed,
  multiplier,
  lineWidth,
  lineType,
  reverseLongLat,
  mapboxStyle,
  maplibreStyle,
  mapProvider,
  deckGLCategoricalColorSchemeTypeSelect,
  deckGLLinearColorSchemeSelect,
  deckGLColorBreakpointsSelect,
  breakpointsDefaultColor,
  tooltipContents,
  tooltipTemplate,
} from '../../utilities/Shared_DeckGL';
import { dndLineColumn } from '../../utilities/sharedDndControls';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example from './images/example.png';
import exampleDark from './images/example-dark.png';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DeckPolygonFormData extends SqlaFormData {
  line_column?: string;
  line_type?: string;
  metric?: string;
  point_radius_fixed?:
    | { value?: string }
    | { type: 'fix'; value: string }
    | { type: 'metric'; value: QueryFormMetric };
  reverse_long_lat?: boolean;
  filter_nulls?: boolean;
  js_columns?: string[];
  cross_filter_column?: string | null;
  tooltip_contents?: unknown[];
  tooltip_template?: string;
}

interface PolygonFeature {
  polygon?: number[][];
  name?: string;
  elevation?: number;
  extraProps?: Record<string, unknown>;
  metrics?: Record<string, number | string>;
}

// ─── buildQuery ──────────────────────────────────────────────────────────────

export function buildQuery(formData: DeckPolygonFormData) {
  const {
    line_column,
    metric,
    point_radius_fixed,
    filter_nulls = true,
    js_columns,
    cross_filter_column,
    tooltip_contents,
  } = formData;

  if (!line_column) {
    throw new Error('Polygon column is required for Polygon charts');
  }

  return buildQueryContext(formData, (baseQueryObject: QueryObject) => {
    let columns: QueryFormColumn[] = [
      ...ensureIsArray(baseQueryObject.columns || []),
      line_column,
    ];

    const jsCols = ensureIsArray(js_columns || []);
    jsCols.forEach((col: string) => {
      if (!columns.includes(col)) {
        columns.push(col);
      }
    });

    if (cross_filter_column && !columns.includes(cross_filter_column)) {
      columns.push(cross_filter_column);
    }

    columns = addTooltipColumnsToQuery(columns, tooltip_contents);

    const metrics = [];
    if (metric) {
      metrics.push(metric);
    }

    if (point_radius_fixed) {
      if ('type' in point_radius_fixed) {
        if (
          point_radius_fixed.type === 'metric' &&
          point_radius_fixed.value != null
        ) {
          metrics.push(point_radius_fixed.value);
        }
      }
    }

    const filters = ensureIsArray(baseQueryObject.filters || []);
    if (filter_nulls) {
      const nullFilters: QueryObjectFilterClause[] = [
        { col: line_column, op: 'IS NOT NULL' },
      ];

      if (metric) {
        nullFilters.push({ col: getMetricLabel(metric), op: 'IS NOT NULL' });
      }

      filters.push(...nullFilters);
    }

    return [
      {
        ...baseQueryObject,
        columns,
        metrics,
        filters,
        is_timeseries: false,
        row_limit: baseQueryObject.row_limit,
      },
    ];
  });
}

// ─── transformProps ──────────────────────────────────────────────────────────

function parseElevationValue(value: string): number | undefined {
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

type PolygonCoordinates = number[][];

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getOwnRecordValue(
  record: DataRecord,
  key: string | undefined,
): string | number | null | undefined {
  if (!key || !Object.prototype.hasOwnProperty.call(record, key)) {
    return undefined;
  }

  return record[key] as string | number | null | undefined;
}

function getGeoJsonGeometry(value: unknown): Record<string, unknown> | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  if (value.coordinates) {
    return value;
  }

  return isPlainRecord(value.geometry) ? value.geometry : null;
}

function getPolygonCoordinateParts(
  value: unknown,
): PolygonCoordinates[] | null {
  if (Array.isArray(value)) {
    return [value as PolygonCoordinates];
  }

  const geometry = getGeoJsonGeometry(value);
  if (!geometry?.coordinates || !Array.isArray(geometry.coordinates)) {
    return null;
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flatMap(polygon =>
      Array.isArray(polygon)
        ? [(polygon[0] || polygon) as PolygonCoordinates]
        : [],
    );
  }

  return [
    (geometry.coordinates[0] || geometry.coordinates) as PolygonCoordinates,
  ];
}

export function processPolygonData(
  records: DataRecord[],
  formData: DeckPolygonFormData,
): PolygonFeature[] {
  const {
    line_column,
    line_type,
    metric,
    point_radius_fixed,
    reverse_long_lat,
    js_columns,
  } = formData;

  if (!line_column || !records.length) {
    return [];
  }

  const metricLabel = getMetricLabelFromFormData(metric);

  let elevationLabel: string | undefined;
  let fixedElevationValue: number | undefined;

  if (point_radius_fixed) {
    if ('type' in point_radius_fixed) {
      if (
        point_radius_fixed.type === 'metric' &&
        point_radius_fixed.value != null
      ) {
        elevationLabel = getMetricLabel(point_radius_fixed.value);
      } else if (
        point_radius_fixed.type === 'fix' &&
        point_radius_fixed.value
      ) {
        fixedElevationValue = parseElevationValue(point_radius_fixed.value);
      }
    } else if (point_radius_fixed.value) {
      fixedElevationValue = parseElevationValue(point_radius_fixed.value);
    }
  }

  const excludeKeys = new Set([line_column, ...(js_columns || [])]);

  return records.flatMap(record => {
    let feature: PolygonFeature = {
      extraProps: {},
      metrics: {},
    };

    feature = addJsColumnsToExtraProps(feature, record, js_columns);
    const updatedFeature = addPropertiesToFeature(
      feature as unknown as Record<string, unknown>,
      record,
      excludeKeys,
    );
    feature = updatedFeature as unknown as PolygonFeature;

    const rawPolygonData = getOwnRecordValue(record, line_column);
    if (!rawPolygonData) {
      return [];
    }

    try {
      let polygonCoordParts: PolygonCoordinates[];

      switch (line_type) {
        case 'json': {
          const parsed =
            typeof rawPolygonData === 'string'
              ? JSON.parse(rawPolygonData)
              : rawPolygonData;
          const parsedPolygonCoordParts = getPolygonCoordinateParts(parsed);

          if (!parsedPolygonCoordParts) {
            return [];
          }

          polygonCoordParts = parsedPolygonCoordParts;
          break;
        }
        case 'geohash': {
          const polygonCoords: PolygonCoordinates = [];
          const decoded = decode_bbox(String(rawPolygonData));
          if (decoded) {
            polygonCoords.push([decoded[1], decoded[0]]);
            polygonCoords.push([decoded[1], decoded[2]]);
            polygonCoords.push([decoded[3], decoded[2]]);
            polygonCoords.push([decoded[3], decoded[0]]);
            polygonCoords.push([decoded[1], decoded[0]]);
          }
          polygonCoordParts = [polygonCoords];
          break;
        }
        case 'zipcode':
        default: {
          polygonCoordParts = [
            Array.isArray(rawPolygonData)
              ? (rawPolygonData as PolygonCoordinates)
              : [],
          ];
          break;
        }
      }

      if (reverse_long_lat) {
        polygonCoordParts = polygonCoordParts.map(polygonCoords =>
          polygonCoords.map(coord => [coord[1], coord[0]]),
        );
      }

      if (fixedElevationValue !== undefined) {
        feature.elevation = fixedElevationValue;
      } else {
        const rawElevationValue = getOwnRecordValue(record, elevationLabel);
        const elevationValue = parseMetricValue(rawElevationValue);
        if (elevationValue !== undefined) {
          feature.elevation = elevationValue;
        }
      }

      if (metricLabel) {
        const metricValue = getOwnRecordValue(record, metricLabel);
        if (
          typeof metricValue === 'string' ||
          typeof metricValue === 'number'
        ) {
          feature.metrics![metricLabel] = metricValue;
        }
      }

      return polygonCoordParts.map(polygonCoords => ({
        ...feature,
        extraProps: { ...feature.extraProps },
        metrics: { ...feature.metrics },
        polygon: polygonCoords,
      }));
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof TypeError) {
        return [];
      }

      throw error;
    }
  });
}

export function transformProps(chartProps: ChartProps) {
  const { rawFormData: formData } = chartProps;
  const records = getRecordsFromQuery(chartProps.queriesData);
  const features = processPolygonData(records, formData as DeckPolygonFormData);

  return createBaseTransformResult(chartProps, features);
}

// ─── Plugin definition ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineChart<Record<string, never>, any>({
  metadata: {
    name: t('deck.gl Polygon'),
    description: t(
      'Visualizes geographic areas from your data as polygons on a Mapbox rendered map. Polygons can be colored using a metric.',
    ),
    category: t('Map'),
    credits: ['https://uber.github.io/deck.gl'],
    behaviors: [Behavior.InteractiveChart],
    tags: [t('deckGL'), t('3D'), t('Multi-Dimensions'), t('Geo')],
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
            ...dndLineColumn,
            config: {
              ...dndLineColumn.config,
              label: t('Polygon Column'),
            },
          },
        ],
        [
          {
            ...lineType,
            config: {
              ...lineType.config,
              label: t('Polygon Encoding'),
            },
          },
        ],
        ['adhoc_filters'],
        ['metric'],
        [
          {
            ...pointRadiusFixed,
            config: {
              ...pointRadiusFixed.config,
              label: t('Elevation'),
            },
          },
        ],
        ['row_limit'],
        [reverseLongLat],
        [filterNulls],
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
        [viewport],
        [autozoom],
      ],
    },
    {
      label: t('Polygon Settings'),
      expanded: true,
      controlSetRows: [
        [
          {
            ...deckGLCategoricalColorSchemeTypeSelect,
            config: {
              ...deckGLCategoricalColorSchemeTypeSelect.config,
              choices: [
                [COLOR_SCHEME_TYPES.fixed_color, t('Fixed color')],
                [COLOR_SCHEME_TYPES.linear_palette, t('Linear palette')],
                [COLOR_SCHEME_TYPES.color_breakpoints, t('Color breakpoints')],
              ],
              default: COLOR_SCHEME_TYPES.linear_palette,
            },
          },
          fillColorPicker,
          deckGLLinearColorSchemeSelect,
          breakpointsDefaultColor,
          deckGLColorBreakpointsSelect,
          strokeColorPicker,
        ],
        [filled, stroked],
        [extruded],
        [multiplier],
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
        [
          {
            name: 'opacity',
            config: {
              type: 'SliderControl',
              label: t('Opacity'),
              default: 80,
              step: 1,
              min: 0,
              max: 100,
              renderTrigger: true,
              description: t('Opacity, expects values between 0 and 100'),
            },
          },
        ],
        [
          {
            name: 'num_buckets',
            config: {
              type: 'SelectControl',
              multi: false,
              freeForm: true,
              label: t('Number of buckets to group data'),
              default: 5,
              choices: formatSelectOptions([2, 3, 5, 10]),
              description: t('How many buckets should the data be grouped in.'),
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'break_points',
            config: {
              type: 'SelectControl',
              multi: true,
              freeForm: true,
              label: t('Bucket break points'),
              choices: formatSelectOptions([]),
              description: t(
                'List of n+1 values for bucketing metric into n buckets.',
              ),
              renderTrigger: true,
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
        [crossFilterColumn],
        [jsColumns],
        [jsDataMutator],
        [jsTooltip],
        [jsOnclickHref],
      ],
    },
  ],
  additionalControlOverrides: {
    metric: {
      validators: [],
    },
    time_grain_sqla: timeGrainSqlaAnimationOverrides,
  },
  formDataOverrides: formData => ({
    ...formData,
    metric: getStandardizedControls().shiftMetric(),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildQuery: (formData: any) => buildQuery(formData as DeckPolygonFormData),
  transform: chartProps => transformProps(chartProps),
  render: props => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <PolygonComponent {...(props as any)} />
  ),
});

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
  buildQueryContext,
  ChartProps,
  ensureIsArray,
  getMapProviderMapStyle,
  QueryFormColumn,
  QueryObject,
  QueryObjectFilterClause,
  SqlaFormData,
} from '@superset-ui/core';
import type { QueryFormData } from '@superset-ui/core';
import type { MapProvider } from '@superset-ui/core/utils/mapStyles';
import { getDefaultMapRenderer } from '@superset-ui/core/utils/mapStyles';
import {
  columnChoices,
  ControlPanelState,
  formatSelectOptions,
  sharedControls,
  getStandardizedControls,
} from '@superset-ui/chart-controls';
import { defineChart } from '@superset-ui/glyph-core';
import Supercluster, {
  type Options as SuperclusterOptions,
} from 'supercluster';
import MapLibre, { DEFAULT_POINT_RADIUS, DEFAULT_MAX_ZOOM } from './MapLibre';
import {
  getPointClusterMapRendererProps,
  POINT_CLUSTER_MAPLIBRE_STYLE_CHOICES,
} from './utils/mapControls';
import roundDecimal from './utils/roundDecimal';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example1 from './images/MapBox.jpg';
import example1Dark from './images/MapBox-dark.jpg';
import example2 from './images/MapBox2.jpg';
import example2Dark from './images/MapBox2-dark.jpg';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MapLibreFormData extends SqlaFormData {
  all_columns_x?: string;
  all_columns_y?: string;
  map_label?: string[];
  point_radius?: string;
  clustering_radius?: string;
  pandas_aggfunc?: string;
  global_opacity?: number;
  maplibre_style?: string;
  mapbox_style?: string;
  map_color?: string;
  render_while_dragging?: boolean;
  point_radius_unit?: string;
}

// ─── buildQuery ──────────────────────────────────────────────────────────────

export function buildQuery(formData: MapLibreFormData) {
  const { all_columns_x, all_columns_y, map_label, point_radius } = formData;

  if (!all_columns_x || !all_columns_y) {
    throw new Error('Longitude and latitude columns are required');
  }

  return buildQueryContext(formData, (baseQueryObject: QueryObject) => {
    const columns: QueryFormColumn[] = [
      ...ensureIsArray(baseQueryObject.columns || []),
      all_columns_x,
      all_columns_y,
    ];

    // Add label column if specified and not 'count'
    const hasCustomMetric =
      map_label && map_label.length > 0 && map_label[0] !== 'count';
    if (hasCustomMetric) {
      columns.push(map_label[0]);
    }

    // Add point radius column if not "Auto"
    if (point_radius && point_radius !== 'Auto') {
      columns.push(point_radius);
    }

    // Add null filters for lon/lat
    const filters: QueryObjectFilterClause[] = ensureIsArray(
      baseQueryObject.filters || [],
    );
    filters.push(
      { col: all_columns_x, op: 'IS NOT NULL' },
      { col: all_columns_y, op: 'IS NOT NULL' },
    );

    // Deduplicate columns
    const uniqueColumns = [...new Set(columns)];

    return [
      {
        ...baseQueryObject,
        columns: uniqueColumns,
        filters,
        is_timeseries: false,
      },
    ];
  });
}

// ─── transformProps ──────────────────────────────────────────────────────────

const NOOP = () => {};

// Geo precision to limit decimal places (matching legacy backend behavior)
const GEO_PRECISION = 10;

const MIN_LONGITUDE = -180;
const MAX_LONGITUDE = 180;
const MIN_LATITUDE = -90;
const MAX_LATITUDE = 90;
const MIN_ZOOM = 0;

function toFiniteNumber(
  value: string | number | null | undefined,
): number | undefined {
  if (value === null || value === undefined) return undefined;
  const normalizedValue = typeof value === 'string' ? value.trim() : value;
  if (normalizedValue === '') return undefined;
  const num = Number(normalizedValue);
  return Number.isFinite(num) ? num : undefined;
}

function clampNumber(
  value: number | undefined,
  min: number,
  max: number,
): number | undefined {
  if (value === undefined) return undefined;
  return Math.min(max, Math.max(min, value));
}

interface PointProperties {
  metric: number | string | null;
  radius: number | string | null;
}

interface ClusterProperties {
  metric: number;
  sum: number;
  squaredSum: number;
  min: number;
  max: number;
}

interface DataRecord {
  [key: string]: string | number | null | undefined;
}

function buildGeoJSONFromRecords(
  records: DataRecord[],
  lonCol: string,
  latCol: string,
  labelCol: string | null,
  pointRadiusCol: string | null,
) {
  const features: GeoJSON.Feature<GeoJSON.Point, PointProperties>[] = [];
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const record of records) {
    const rawLon = record[lonCol];
    const rawLat = record[latCol];
    if (rawLon == null || rawLat == null) {
      continue;
    }
    const lon = Number(rawLon);
    const lat = Number(rawLat);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      continue;
    }

    const roundedLon = roundDecimal(lon, GEO_PRECISION);
    const roundedLat = roundDecimal(lat, GEO_PRECISION);

    minLon = Math.min(minLon, roundedLon);
    maxLon = Math.max(maxLon, roundedLon);
    minLat = Math.min(minLat, roundedLat);
    maxLat = Math.max(maxLat, roundedLat);

    const metric = labelCol != null ? (record[labelCol] ?? null) : null;
    const radius =
      pointRadiusCol != null ? (record[pointRadiusCol] ?? null) : null;

    features.push({
      type: 'Feature',
      properties: { metric, radius },
      geometry: {
        type: 'Point',
        coordinates: [roundedLon, roundedLat],
      },
    });
  }

  const bounds: [[number, number], [number, number]] | undefined =
    features.length > 0
      ? [
          [minLon, minLat],
          [maxLon, maxLat],
        ]
      : undefined;

  return {
    geoJSON: { type: 'FeatureCollection' as const, features },
    bounds,
  };
}

export function transformProps(chartProps: ChartProps) {
  const {
    width,
    height,
    rawFormData: formData,
    hooks,
    queriesData,
  } = chartProps;
  const { onError = NOOP, setControlValue = NOOP } = hooks;

  const {
    all_columns_x: allColumnsX,
    all_columns_y: allColumnsY,
    clustering_radius: clusteringRadius,
    global_opacity: globalOpacity,
    map_color: maplibreColor,
    map_label: maplibreLabel,
    map_renderer: mapProvider,
    maplibre_style: maplibreStyle,
    mapbox_style: mapboxStyle = '',
    map_style: legacyMapStyle,
    pandas_aggfunc: pandasAggfunc,
    point_radius: pointRadius,
    point_radius_unit: pointRadiusUnit,
    render_while_dragging: renderWhileDragging,
    viewport_longitude: viewportLongitude,
    viewport_latitude: viewportLatitude,
    viewport_zoom: viewportZoom,
  } = formData;

  // Support two data formats:
  // 1. Legacy/GeoJSON: queriesData[0].data is an object with { geoJSON, bounds, hasCustomMetric }
  // 2. Tabular records: queriesData[0].data is an array of flat records from a SQL query
  const rawData = queriesData[0]?.data;
  const isLegacyFormat = rawData && !Array.isArray(rawData) && rawData.geoJSON;

  let geoJSON: { type: 'FeatureCollection'; features: any[] };
  let bounds: [[number, number], [number, number]] | undefined;
  let hasCustomMetric: boolean;

  if (isLegacyFormat) {
    const legacy = rawData as any;
    ({ geoJSON } = legacy);
    ({ bounds } = legacy);
    hasCustomMetric = legacy.hasCustomMetric ?? false;
  } else {
    const records: DataRecord[] = (rawData as DataRecord[]) || [];
    hasCustomMetric =
      maplibreLabel != null &&
      maplibreLabel.length > 0 &&
      maplibreLabel[0] !== 'count';
    const labelCol = hasCustomMetric ? maplibreLabel[0] : null;
    const pointRadiusCol =
      pointRadius && pointRadius !== 'Auto' ? pointRadius : null;

    const built = buildGeoJSONFromRecords(
      records,
      allColumnsX,
      allColumnsY,
      labelCol,
      pointRadiusCol,
    );
    ({ geoJSON } = built);
    ({ bounds } = built);
  }

  // Validate color — supports hex (#rrggbb) and rgb(r, g, b) formats
  let rgb: string[] | null = null;
  const hexMatch = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(
    maplibreColor,
  );
  if (hexMatch) {
    rgb = [
      maplibreColor,
      String(parseInt(hexMatch[1], 16)),
      String(parseInt(hexMatch[2], 16)),
      String(parseInt(hexMatch[3], 16)),
    ];
  } else {
    rgb = /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/.exec(maplibreColor);
  }
  if (rgb === null) {
    onError(t("Color field must be a hex color (#rrggbb) or 'rgb(r, g, b)'"));
    // Fall back to a safe default color so the chart can still render
    rgb = ['', '0', '0', '0'];
  }

  const opts: SuperclusterOptions<PointProperties, ClusterProperties> = {
    maxZoom: DEFAULT_MAX_ZOOM,
    radius: clusteringRadius,
  };
  if (hasCustomMetric) {
    opts.map = (prop: PointProperties) => ({
      metric: Number(prop.metric) || 0,
      sum: Number(prop.metric) || 0,
      squaredSum: (Number(prop.metric) || 0) ** 2,
      min: Number(prop.metric) || 0,
      max: Number(prop.metric) || 0,
    });
    opts.reduce = (accu: ClusterProperties, prop: ClusterProperties) => {
      /* eslint-disable no-param-reassign */
      accu.sum += prop.sum;
      accu.squaredSum += prop.squaredSum;
      accu.min = Math.min(accu.min, prop.min);
      accu.max = Math.max(accu.max, prop.max);
      /* eslint-enable no-param-reassign */
    };
  }
  const clusterer = new Supercluster<PointProperties, ClusterProperties>(opts);
  // Disable strict typecheck on load since Supercluster typings have namespace issues with esModuleInterop
  clusterer.load(geoJSON.features as any);
  const selectedMap = getMapProviderMapStyle({
    mapProvider,
    maplibreStyle,
    mapboxStyle,
    legacyMapStyle,
  });

  return {
    width,
    height,
    aggregatorName: pandasAggfunc,
    bounds,
    clusterer,
    globalOpacity: Math.min(1, Math.max(0, toFiniteNumber(globalOpacity) ?? 1)),
    hasCustomMetric,
    mapProvider: selectedMap.mapProvider,
    mapStyle: selectedMap.mapStyle,
    onViewportChange({
      latitude,
      longitude,
      zoom,
    }: {
      latitude: number;
      longitude: number;
      zoom: number;
    }) {
      setControlValue('viewport_longitude', longitude);
      setControlValue('viewport_latitude', latitude);
      setControlValue('viewport_zoom', zoom);
    },
    pointRadius: DEFAULT_POINT_RADIUS,
    pointRadiusUnit,
    renderWhileDragging,
    rgb,
    viewportLongitude: clampNumber(
      toFiniteNumber(viewportLongitude),
      MIN_LONGITUDE,
      MAX_LONGITUDE,
    ),
    viewportLatitude: clampNumber(
      toFiniteNumber(viewportLatitude),
      MIN_LATITUDE,
      MAX_LATITUDE,
    ),
    viewportZoom: clampNumber(
      toFiniteNumber(viewportZoom),
      MIN_ZOOM,
      DEFAULT_MAX_ZOOM,
    ),
  };
}

// ─── Control panel pieces ────────────────────────────────────────────────────

const columnsConfig = sharedControls.entity;

/* eslint-disable theme-colors/no-literal-colors */
const colorChoices = [
  ['#008b8b', t('Dark Cyan')],
  ['#800080', t('Purple')],
  ['#ffd700', t('Gold')],
  ['#454545', t('Dim Gray')],
  ['#dc143c', t('Crimson')],
  ['#228b22', t('Forest Green')],
];
/* eslint-enable theme-colors/no-literal-colors */

type MapStyleVisibilityProps = {
  controls?: {
    map_renderer?: { value?: unknown };
  };
};

// ─── Plugin definition ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineChart<Record<string, never>, any>({
  metadata: {
    category: t('Map'),
    credits: ['https://maplibre.org/'],
    description: '',
    exampleGallery: [
      { url: example1, urlDark: example1Dark, caption: t('Light mode') },
      { url: example2, urlDark: example2Dark, caption: t('Dark mode') },
    ],
    name: t('Point Cluster Map'),
    tags: [
      t('Business'),
      t('Intensity'),
      t('Density'),
      t('Scatter'),
      t('Transformable'),
    ],
    thumbnail,
    thumbnailDark,
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
            name: 'all_columns_x',
            config: {
              ...columnsConfig,
              label: t('Longitude'),
              description: t('Column containing longitude data'),
            },
          },
        ],
        [
          {
            name: 'all_columns_y',
            config: {
              ...columnsConfig,
              label: t('Latitude'),
              description: t('Column containing latitude data'),
            },
          },
        ],
        [
          {
            name: 'clustering_radius',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Clustering Radius'),
              default: '60',
              choices: formatSelectOptions([
                '0',
                '20',
                '40',
                '60',
                '80',
                '100',
                '200',
                '500',
                '1000',
              ]),
              description: t(
                'The radius (in pixels) the algorithm uses to define a cluster. ' +
                  'Choose 0 to turn off clustering, but beware that a large ' +
                  'number of points (>1000) will cause lag.',
              ),
            },
          },
        ],
        ['row_limit'],
        ['adhoc_filters'],
        ['groupby'],
      ],
    },
    {
      label: t('Points'),
      controlSetRows: [
        [
          {
            name: 'point_radius',
            config: {
              type: 'SelectControl',
              label: t('Point Radius'),
              default: 'Auto',
              description: t(
                'The radius of individual points (ones that are not in a cluster). ' +
                  'Either a numerical column or `Auto`, which scales the point based ' +
                  'on the largest cluster',
              ),
              mapStateToProps: (state: any) => {
                const datasourceChoices = columnChoices(state.datasource);
                const choices: [string, string][] = [['Auto', t('Auto')]];
                return {
                  choices: choices.concat(datasourceChoices),
                };
              },
            },
          },
        ],
        [
          {
            name: 'point_radius_unit',
            config: {
              type: 'SelectControl',
              label: t('Point Radius Unit'),
              default: 'Pixels',
              choices: [
                ['Pixels', t('Pixels')],
                ['Miles', t('Miles')],
                ['Kilometers', t('Kilometers')],
              ],
              description: t(
                'The unit of measure for the specified point radius',
              ),
            },
          },
        ],
      ],
    },
    {
      label: t('Labelling'),
      controlSetRows: [
        [
          {
            name: 'map_label',
            config: {
              type: 'SelectControl',
              multi: true,
              label: t('label'),
              default: [],
              description: t(
                '`count` is COUNT(*) if a group by is used. ' +
                  'Numerical columns will be aggregated with the aggregator. ' +
                  'Non-numerical columns will be used to label points. ' +
                  'Leave empty to get a count of points in each cluster.',
              ),
              mapStateToProps: (state: any) => ({
                choices: columnChoices(state.datasource),
              }),
            },
          },
        ],
        [
          {
            name: 'pandas_aggfunc',
            config: {
              type: 'SelectControl',
              label: t('Cluster label aggregator'),
              clearable: false,
              choices: [
                ['sum', t('sum')],
                ['mean', t('mean')],
                ['min', t('min')],
                ['max', t('max')],
                ['std', t('std')],
                ['var', t('var')],
              ],
              default: 'sum',
              description: t(
                'Aggregate function applied to the list of points ' +
                  'in each cluster to produce the cluster label.',
              ),
            },
          },
        ],
      ],
    },
    {
      label: t('Map'),
      tabOverride: 'customize',
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'map_renderer',
            config: {
              type: 'SelectControl',
              label: t('Map Renderer'),
              clearable: false,
              renderTrigger: true,
              options: getPointClusterMapRendererProps().options,
              default: 'maplibre',
              description: t(
                'MapLibre is open-source and requires no API key. Mapbox requires MAPBOX_API_KEY to be configured on the server.',
              ),
              mapStateToProps: (state: ControlPanelState) => ({
                ...getPointClusterMapRendererProps(
                  state.form_data?.map_renderer as MapProvider | undefined,
                ),
                default: getDefaultMapRenderer(),
              }),
            },
          },
        ],
        [
          {
            name: 'maplibre_style',
            config: {
              type: 'SelectControl',
              label: t('Map Style'),
              clearable: false,
              renderTrigger: true,
              freeForm: true,
              choices: POINT_CLUSTER_MAPLIBRE_STYLE_CHOICES,
              default: 'https://tiles.openfreemap.org/styles/liberty',
              description: t(
                'Base layer map style. See MapLibre documentation: %s',
                'https://maplibre.org/maplibre-style-spec/',
              ),
              visibility: ({ controls }: MapStyleVisibilityProps) =>
                controls?.map_renderer?.value !== 'mapbox',
            },
          },
        ],
        [
          {
            name: 'mapbox_style',
            config: {
              type: 'SelectControl',
              label: t('Map Style'),
              clearable: false,
              renderTrigger: true,
              freeForm: true,
              choices: [
                ['mapbox://styles/mapbox/streets-v12', t('Streets')],
                ['mapbox://styles/mapbox/outdoors-v12', t('Outdoors')],
                ['mapbox://styles/mapbox/light-v11', t('Light')],
                ['mapbox://styles/mapbox/dark-v11', t('Dark')],
                ['mapbox://styles/mapbox/satellite-v9', t('Satellite')],
                [
                  'mapbox://styles/mapbox/satellite-streets-v12',
                  t('Satellite Streets'),
                ],
              ],
              default: 'mapbox://styles/mapbox/light-v11',
              description: t(
                'Base layer map style. Accepts a Mapbox style URL (mapbox://styles/...).',
              ),
              visibility: ({ controls }: MapStyleVisibilityProps) =>
                controls?.map_renderer?.value === 'mapbox',
            },
          },
        ],
      ],
    },
    {
      label: t('Visual Tweaks'),
      tabOverride: 'customize',
      controlSetRows: [
        [
          {
            name: 'render_while_dragging',
            config: {
              type: 'CheckboxControl',
              label: t('Live render'),
              renderTrigger: true,
              default: true,
              description: t(
                'Points and clusters will update as the viewport is being changed',
              ),
            },
          },
        ],
        [
          {
            name: 'global_opacity',
            config: {
              type: 'TextControl',
              label: t('Opacity'),
              renderTrigger: true,
              default: 1,
              isFloat: true,
              description: t(
                'Opacity of all clusters, points, and labels. Between 0 and 1.',
              ),
            },
          },
        ],
        [
          {
            name: 'map_color',
            config: {
              type: 'SelectControl',
              freeForm: true,
              renderTrigger: true,
              label: t('RGB Color'),
              default: colorChoices[0][0],
              choices: colorChoices,
              description: t('The color for points and clusters in RGB'),
            },
          },
        ],
      ],
    },
    {
      label: t('Viewport'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'viewport_longitude',
            config: {
              type: 'TextControl',
              label: t('Default longitude'),
              renderTrigger: true,
              default: '',
              isFloat: true,
              description: t('Longitude of default viewport'),
              places: 8,
              dontRefreshOnChange: true,
            },
          },
          {
            name: 'viewport_latitude',
            config: {
              type: 'TextControl',
              label: t('Default latitude'),
              renderTrigger: true,
              default: '',
              isFloat: true,
              description: t('Latitude of default viewport'),
              places: 8,
              dontRefreshOnChange: true,
            },
          },
        ],
        [
          {
            name: 'viewport_zoom',
            config: {
              type: 'TextControl',
              label: t('Zoom'),
              renderTrigger: true,
              isFloat: true,
              default: '',
              description: t('Zoom level of the map'),
              places: 8,
              dontRefreshOnChange: true,
            },
          },
          null,
        ],
      ],
    },
  ],
  additionalControlOverrides: {
    groupby: {
      description: t(
        'One or many controls to group by. If grouping, latitude ' +
          'and longitude columns must be present.',
      ),
    },
  },
  formDataOverrides: (formData: QueryFormData) => ({
    ...formData,
    groupby: getStandardizedControls().popAllColumns(),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildQuery: (formData: any) => buildQuery(formData as MapLibreFormData),
  transform: chartProps => transformProps(chartProps),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render: props => <MapLibre {...(props as any)} />,
});

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
import Supercluster, {
  type Options as SuperclusterOptions,
} from 'supercluster';
import { ChartProps } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { DEFAULT_POINT_RADIUS, DEFAULT_MAX_ZOOM } from './MapLibre';
import roundDecimal from './utils/roundDecimal';

const NOOP = () => {};

// Geo precision to limit decimal places (matching legacy backend behavior)
const GEO_PRECISION = 10;

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
    const lon = Number(record[lonCol]);
    const lat = Number(record[latCol]);
    if (Number.isNaN(lon) || Number.isNaN(lat)) {
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

export default function transformProps(chartProps: ChartProps) {
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
    pandas_aggfunc: pandasAggfunc,
    point_radius: pointRadius,
    point_radius_unit: pointRadiusUnit,
    render_while_dragging: renderWhileDragging,
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

  return {
    width,
    height,
    aggregatorName: pandasAggfunc,
    bounds,
    clusterer,
    globalOpacity,
    hasCustomMetric,
    mapProvider,
    mapStyle:
      mapProvider === 'mapbox'
        ? (mapboxStyle as string)
        : (maplibreStyle as string),
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
  };
}

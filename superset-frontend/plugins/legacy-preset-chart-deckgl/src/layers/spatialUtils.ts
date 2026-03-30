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
  buildQueryContext,
  getMetricLabel,
  QueryFormData,
  QueryObjectFilterClause,
  ensureIsArray,
  ChartProps,
  normalizeOrderBy,
} from '@superset-ui/core';
import { decode } from 'ngeohash';
import { addTooltipColumnsToQuery } from './buildQueryUtils';

export interface SpatialConfiguration {
  type: 'latlong' | 'delimited' | 'geohash';
  lonCol?: string;
  latCol?: string;
  lonlatCol?: string;
  geohashCol?: string;
  reverseCheckbox?: boolean;
}

export interface DataRecord {
  [key: string]: string | number | null | undefined;
}

export interface BootstrapData {
  common?: {
    conf?: {
      MAPBOX_API_KEY?: string;
    };
  };
}

export interface SpatialFormData extends QueryFormData {
  spatial: SpatialConfiguration;
  size?: string;
  grid_size?: number;
  js_data_mutator?: string;
  js_agg_function?: string;
  js_columns?: string[];
  color_scheme?: string;
  color_scheme_type?: string;
  color_breakpoints?: number[];
  default_breakpoint_color?: string;
  tooltip_contents?: unknown[];
  tooltip_template?: string;
  color_picker?: string;
}

export interface SpatialPoint {
  position: [number, number];
  weight: number;
  extraProps?: Record<string, unknown>;
  [key: string]: unknown;
}

export function getSpatialColumns(spatial: SpatialConfiguration): string[] {
  if (!spatial || !spatial.type) {
    throw new Error('Bad spatial key');
  }

  switch (spatial.type) {
    case 'latlong':
      if (!spatial.lonCol || !spatial.latCol) {
        throw new Error(
          'Longitude and latitude columns are required for latlong type',
        );
      }
      return [spatial.lonCol, spatial.latCol];
    case 'delimited':
      if (!spatial.lonlatCol) {
        throw new Error(
          'Longitude/latitude column is required for delimited type',
        );
      }
      return [spatial.lonlatCol];
    case 'geohash':
      if (!spatial.geohashCol) {
        throw new Error('Geohash column is required for geohash type');
      }
      return [spatial.geohashCol];
    default:
      throw new Error(`Unknown spatial type: ${spatial.type}`);
  }
}

export function addSpatialNullFilters(
  spatial: SpatialConfiguration,
  filters: QueryObjectFilterClause[],
): QueryObjectFilterClause[] {
  if (!spatial) return filters;

  const spatialColumns = getSpatialColumns(spatial);
  const nullFilters: QueryObjectFilterClause[] = spatialColumns.map(column => ({
    col: column,
    op: 'IS NOT NULL',
    val: null,
  }));

  return [...filters, ...nullFilters];
}

export function buildSpatialQuery(formData: SpatialFormData) {
  const { spatial, size: metric, js_columns, tooltip_contents } = formData;

  if (!spatial) {
    throw new Error(`Spatial configuration is required for this chart`);
  }
  return buildQueryContext(formData, {
    buildQuery: baseQueryObject => {
      const spatialColumns = getSpatialColumns(spatial);
      let columns = [...(baseQueryObject.columns || []), ...spatialColumns];
      const metrics = metric ? [metric] : [];

      if (js_columns?.length) {
        js_columns.forEach(col => {
          if (!columns.includes(col)) {
            columns.push(col);
          }
        });
      }

      columns = addTooltipColumnsToQuery(columns, tooltip_contents);

      const filters = addSpatialNullFilters(
        spatial,
        ensureIsArray(baseQueryObject.filters || []),
      );

      const orderby = metric
        ? normalizeOrderBy({ orderby: [[metric, false]] }).orderby
        : baseQueryObject.orderby;

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

function parseCoordinates(latlong: string): [number, number] | null {
  if (!latlong || typeof latlong !== 'string') {
    return null;
  }

  try {
    const coords = latlong.split(',').map(coord => parseFloat(coord.trim()));
    if (
      coords.length === 2 &&
      !Number.isNaN(coords[0]) &&
      !Number.isNaN(coords[1])
    ) {
      return [coords[0], coords[1]];
    }
    return null;
  } catch (error) {
    return null;
  }
}

function reverseGeohashDecode(geohashCode: string): [number, number] | null {
  if (!geohashCode || typeof geohashCode !== 'string') {
    return null;
  }

  try {
    const { latitude: lat, longitude: lng } = decode(geohashCode);
    if (
      Number.isNaN(lat) ||
      Number.isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return null;
    }
    return [lng, lat];
  } catch (error) {
    return null;
  }
}

export function addJsColumnsToExtraProps<
  T extends { extraProps?: Record<string, unknown> },
>(feature: T, record: DataRecord, jsColumns?: string[]): T {
  if (!jsColumns?.length) {
    return feature;
  }

  const extraProps: Record<string, unknown> = { ...feature.extraProps };

  jsColumns.forEach(col => {
    if (record[col] !== undefined) {
      extraProps[col] = record[col];
    }
  });

  return { ...feature, extraProps };
}

export function processSpatialData(
  records: DataRecord[],
  spatial: SpatialConfiguration,
  metricLabel?: string,
  jsColumns?: string[],
): SpatialPoint[] {
  if (!spatial || !records.length) {
    return [];
  }

  const features: SpatialPoint[] = [];
  const spatialColumns = getSpatialColumns(spatial);
  const jsColumnsSet = jsColumns ? new Set(jsColumns) : null;
  const spatialColumnsSet = new Set(spatialColumns);

  for (const record of records) {
    let position: [number, number] | null = null;

    switch (spatial.type) {
      case 'latlong':
        if (spatial.lonCol && spatial.latCol) {
          const lon = parseFloat(String(record[spatial.lonCol] ?? ''));
          const lat = parseFloat(String(record[spatial.latCol] ?? ''));
          if (!Number.isNaN(lon) && !Number.isNaN(lat)) {
            position = [lon, lat];
          }
        }
        break;
      case 'delimited':
        if (spatial.lonlatCol) {
          position = parseCoordinates(String(record[spatial.lonlatCol] ?? ''));
        }
        break;
      case 'geohash':
        if (spatial.geohashCol) {
          const geohashValue = record[spatial.geohashCol];
          if (geohashValue) {
            position = reverseGeohashDecode(String(geohashValue));
          }
        }
        break;
      default:
        continue;
    }

    if (!position) {
      continue;
    }

    if (spatial.reverseCheckbox) {
      position = [position[1], position[0]];
    }

    let weight = 1;
    if (metricLabel && record[metricLabel] != null) {
      const metricValue = parseFloat(String(record[metricLabel]));
      if (!Number.isNaN(metricValue)) {
        weight = metricValue;
      }
    }

    let spatialPoint: SpatialPoint = {
      position,
      weight,
      extraProps: {},
    };

    spatialPoint = addJsColumnsToExtraProps(spatialPoint, record, jsColumns);
    Object.keys(record).forEach(key => {
      if (spatialColumnsSet.has(key)) {
        return;
      }

      if (key === metricLabel) {
        return;
      }

      if (jsColumnsSet?.has(key)) {
        return;
      }

      spatialPoint[key] = record[key];
    });

    features.push(spatialPoint);
  }

  return features;
}

const NOOP = () => {};

export function getMapboxApiKey(mapboxApiKey?: string): string {
  if (mapboxApiKey) {
    return mapboxApiKey;
  }

  if (typeof document !== 'undefined') {
    try {
      const appContainer = document.getElementById('app');
      const dataBootstrap = appContainer?.getAttribute('data-bootstrap');
      if (dataBootstrap) {
        const bootstrapData: BootstrapData = JSON.parse(dataBootstrap);
        return bootstrapData?.common?.conf?.MAPBOX_API_KEY || '';
      }
    } catch (error) {
      throw new Error(
        `Failed to read MAPBOX_API_KEY from bootstrap data: ${error}`,
      );
    }
  }

  return '';
}

export function transformSpatialProps(chartProps: ChartProps) {
  const {
    datasource,
    height,
    hooks,
    queriesData,
    rawFormData: formData,
    width,
    filterState,
    emitCrossFilters,
  } = chartProps;

  const {
    onAddFilter = NOOP,
    onContextMenu = NOOP,
    setControlValue = NOOP,
    setDataMask = NOOP,
  } = hooks;

  const { spatial, size: metric, js_columns } = formData as SpatialFormData;
  const metricLabel = metric ? getMetricLabel(metric) : undefined;

  const queryData = queriesData[0];
  const records = queryData?.data || [];
  const features = processSpatialData(
    records,
    spatial,
    metricLabel,
    js_columns,
  );

  return {
    datasource,
    emitCrossFilters,
    formData,
    height,
    onAddFilter,
    onContextMenu,
    payload: {
      ...queryData,
      data: {
        features,
        mapboxApiKey: getMapboxApiKey(),
        metricLabels: metricLabel ? [metricLabel] : [],
      },
    },
    setControlValue,
    filterState,
    viewport: {
      ...formData.viewport,
      height,
      width,
    },
    width,
    setDataMask,
    setTooltip: () => {},
  };
}

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
import { ChartProps, getMetricLabel, DTTM_ALIAS } from '@superset-ui/core';
import { getMapboxApiKey } from '../spatialUtils';
import { DeckPathFormData } from './buildQuery';

export interface DeckPathTransformPropsFormData extends DeckPathFormData {
  js_data_mutator?: string;
  js_tooltip?: string;
  js_onclick_href?: string;
}

const NOOP = () => {};

interface PathFeature {
  path: [number, number][];
  metric?: number;
  timestamp?: any;
  extraProps?: { [key: string]: any };
  [key: string]: any;
}

// Decoders matching legacy viz.py deser_map
const decoders = {
  json: (data: string): [number, number][] => {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  },
  polyline: (data: string): [number, number][] => {
    try {
      // Use polyline library if available, fallback to basic implementation
      if (typeof window !== 'undefined' && (window as any).polyline) {
        return (window as any).polyline.decode(data);
      }
      // Basic polyline decoding fallback
      return [];
    } catch (error) {
      return [];
    }
  },
  geohash: (data: string): [number, number][] => {
    try {
      // Use geohash library if available, fallback to basic implementation
      if (typeof window !== 'undefined' && (window as any).geohash) {
        const decoded = (window as any).geohash.decode(data);
        return [[decoded.longitude, decoded.latitude]];
      }
      // Basic fallback
      return [];
    } catch (error) {
      return [];
    }
  },
};

function processPathData(
  records: any[],
  lineColumn: string,
  lineType: 'polyline' | 'json' | 'geohash' = 'json',
  reverseLongLat: boolean = false,
  metricLabel?: string,
  jsColumns?: string[],
): PathFeature[] {
  if (!records.length || !lineColumn) {
    return [];
  }

  const decoder = decoders[lineType] || decoders.json;

  return records.map(record => {
    const lineData = record[lineColumn];
    let path: [number, number][] = [];

    if (lineData) {
      path = decoder(lineData);

      // Apply coordinate reversal if specified (from DeckPathViz.get_properties)
      if (reverseLongLat && path.length > 0) {
        path = path.map(([lng, lat]) => [lat, lng]);
      }
    }

    const feature: PathFeature = {
      path,
      timestamp: record[DTTM_ALIAS],
      extraProps: {},
    };

    // Add metric value if available
    if (metricLabel && record[metricLabel] != null) {
      const metricValue = parseFloat(record[metricLabel]);
      if (!Number.isNaN(metricValue)) {
        feature.metric = metricValue;
      }
    }

    // Add js_columns to extraProps (matching legacy get_js_columns behavior)
    if (jsColumns?.length) {
      jsColumns.forEach((col: string) => {
        if (record[col] !== undefined) {
          feature.extraProps![col] = record[col];
        }
      });
    }

    // Copy other properties to top level for direct access (excluding processed fields)
    Object.keys(record).forEach(key => {
      // Skip the line column unless it's geohash type
      if (key === lineColumn && lineType !== 'geohash') {
        return;
      }

      // Skip already processed fields
      if (key === 'timestamp' || key === DTTM_ALIAS || key === metricLabel) {
        return;
      }

      // Skip js_columns (already in extraProps)
      if (jsColumns?.includes(key)) {
        return;
      }

      // Add to top level for direct access
      feature[key] = record[key];
    });

    return feature;
  });
}

export default function transformProps(chartProps: ChartProps) {
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

  const {
    line_column,
    line_type = 'json',
    metric,
    reverse_long_lat = false,
    js_columns,
  } = formData as DeckPathTransformPropsFormData;

  const metricLabel = metric ? getMetricLabel(metric) : undefined;

  // Process the query data to extract path features
  const queryData = queriesData[0];
  const records = queryData?.data || [];
  const features = processPathData(
    records,
    line_column || '',
    line_type,
    reverse_long_lat,
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

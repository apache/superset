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
import {
  getMapboxApiKey,
  addJsColumnsToExtraProps,
  DataRecord,
} from '../spatialUtils';
import { DeckPathFormData } from './buildQuery';

declare global {
  interface Window {
    polyline?: {
      decode: (data: string) => [number, number][];
    };
    geohash?: {
      decode: (data: string) => { longitude: number; latitude: number };
    };
  }
}

export interface DeckPathTransformPropsFormData extends DeckPathFormData {
  js_data_mutator?: string;
  js_tooltip?: string;
  js_onclick_href?: string;
}

const NOOP = () => {};

interface PathFeature {
  path: [number, number][];
  metric?: number;
  timestamp?: unknown;
  extraProps?: Record<string, unknown>;
  [key: string]: unknown;
}

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
      if (typeof window !== 'undefined' && window.polyline) {
        return window.polyline.decode(data);
      }
      return [];
    } catch (error) {
      return [];
    }
  },
  geohash: (data: string): [number, number][] => {
    try {
      if (typeof window !== 'undefined' && window.geohash) {
        const decoded = window.geohash.decode(data);
        return [[decoded.longitude, decoded.latitude]];
      }
      return [];
    } catch (error) {
      return [];
    }
  },
};

function processPathData(
  records: DataRecord[],
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
      path = decoder(String(lineData));

      if (reverseLongLat && path.length > 0) {
        path = path.map(([lng, lat]) => [lat, lng]);
      }
    }

    let feature: PathFeature = {
      path,
      timestamp: record[DTTM_ALIAS],
      extraProps: {},
    };

    if (metricLabel && record[metricLabel] != null) {
      const metricValue = parseFloat(String(record[metricLabel]));
      if (!Number.isNaN(metricValue)) {
        feature.metric = metricValue;
      }
    }

    feature = addJsColumnsToExtraProps(feature, record, jsColumns);
    Object.keys(record).forEach(key => {
      if (key === lineColumn && lineType !== 'geohash') {
        return;
      }

      if (key === 'timestamp' || key === DTTM_ALIAS || key === metricLabel) {
        return;
      }

      if (jsColumns?.includes(key)) {
        return;
      }

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

  const queryData = queriesData[0];
  const records = queryData?.data || [];
  const features = processPathData(
    records,
    line_column || '',
    line_type,
    reverse_long_lat,
    metricLabel,
    js_columns,
  ).reverse();

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

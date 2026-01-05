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
import { ChartProps } from '@superset-ui/core';
import Supercluster from 'supercluster';
import { DEFAULT_POINT_RADIUS, DEFAULT_MAX_ZOOM } from './MapBox';

const NOOP = () => {};

export interface FormData {
  clusteringRadius: number;
  globalOpacity: number;
  mapboxColor: string;
  mapboxStyle: string;
  pandasAggfunc: string;
  pointRadius: number | string;
  pointRadiusUnit: string;
  renderWhileDragging: boolean;
}

interface ViewportChangeParams {
  latitude: number;
  longitude: number;
  zoom: number;
}

interface ClusterOptions {
  maxZoom: number;
  radius: number;
  initial?: () => {
    sum: number;
    squaredSum: number;
    min: number;
    max: number;
  };
  map?: (prop: { metric: number }) => {
    sum: number;
    squaredSum: number;
    min: number;
    max: number;
  };
  reduce?: (
    accu: {
      sum: number;
      squaredSum: number;
      min: number;
      max: number;
    },
    prop: {
      sum: number;
      squaredSum: number;
      min: number;
      max: number;
    },
  ) => void;
}

interface TransformedProps {
  width?: number;
  height?: number;
  aggregatorName?: string;
  bounds?: [[number, number], [number, number]];
  clusterer?: Supercluster;
  globalOpacity?: number;
  hasCustomMetric?: boolean;
  mapboxApiKey?: string;
  mapStyle?: string;
  onViewportChange?: (params: ViewportChangeParams) => void;
  pointRadius?: number;
  pointRadiusUnit?: string;
  renderWhileDragging?: boolean;
  rgb?: [number, number, number, number];
}

export default function transformProps(
  chartProps: ChartProps<FormData>,
): TransformedProps {
  const { width, height, formData, hooks, queriesData } = chartProps;
  const { onError = NOOP, setControlValue = NOOP } = hooks;
  const { bounds, geoJSON, hasCustomMetric, mapboxApiKey } =
    queriesData[0].data;
  const {
    clusteringRadius,
    globalOpacity,
    mapboxColor,
    mapboxStyle,
    pandasAggfunc,
    pointRadius,
    pointRadiusUnit,
    renderWhileDragging,
  } = formData;

  // Validate mapbox color
  const rgbMatch = /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/.exec(
    mapboxColor,
  );
  if (rgbMatch === null) {
    onError("Color field must be of form 'rgb(%d, %d, %d)'");

    const emptyClusterer = new Supercluster({
      maxZoom: DEFAULT_MAX_ZOOM,
      radius: clusteringRadius,
    });
    emptyClusterer.load([]);

    return {
      width,
      height,
      bounds: bounds || [
        [0, 0],
        [0, 0],
      ],
      clusterer: emptyClusterer,
      globalOpacity: globalOpacity ?? 1,
      hasCustomMetric: false,
      mapboxApiKey,
      mapStyle: mapboxStyle,
      onViewportChange: NOOP,
      pointRadius: DEFAULT_POINT_RADIUS,
      pointRadiusUnit: pointRadiusUnit || 'Pixels',
      renderWhileDragging: renderWhileDragging ?? true,
      rgb: [128, 128, 128, 255],
    };
  }

  const rgb: [number, number, number, number] = [
    parseInt(rgbMatch[1], 10),
    parseInt(rgbMatch[2], 10),
    parseInt(rgbMatch[3], 10),
    255,
  ];

  const opts: ClusterOptions = {
    maxZoom: DEFAULT_MAX_ZOOM,
    radius: clusteringRadius,
  };
  if (hasCustomMetric) {
    opts.initial = () => ({
      sum: 0,
      squaredSum: 0,
      min: Infinity,
      max: -Infinity,
    });
    opts.map = (prop: { metric: number }) => ({
      sum: prop.metric,
      squaredSum: prop.metric ** 2,
      min: prop.metric,
      max: prop.metric,
    });
    opts.reduce = (
      accu: {
        sum: number;
        squaredSum: number;
        min: number;
        max: number;
      },
      prop: {
        sum: number;
        squaredSum: number;
        min: number;
        max: number;
      },
    ) => {
      // Temporarily disable param-reassignment linting to work with supercluster's api
      /* eslint-disable no-param-reassign */
      accu.sum += prop.sum;
      accu.squaredSum += prop.squaredSum;
      accu.min = Math.min(accu.min, prop.min);
      accu.max = Math.max(accu.max, prop.max);
      /* eslint-enable no-param-reassign */
    };
  }
  const clusterer = new Supercluster(opts);
  clusterer.load(geoJSON.features);

  return {
    width,
    height,
    aggregatorName: pandasAggfunc,
    bounds,
    clusterer,
    globalOpacity,
    hasCustomMetric,
    mapboxApiKey,
    mapStyle: mapboxStyle,
    onViewportChange({ latitude, longitude, zoom }: ViewportChangeParams) {
      setControlValue('viewport_longitude', longitude);
      setControlValue('viewport_latitude', latitude);
      setControlValue('viewport_zoom', zoom);
    },
    pointRadius:
      pointRadius === 'Auto' ? DEFAULT_POINT_RADIUS : Number(pointRadius),
    pointRadiusUnit,
    renderWhileDragging,
    rgb,
  };
}

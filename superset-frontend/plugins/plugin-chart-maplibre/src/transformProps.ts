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
import { DEFAULT_POINT_RADIUS, DEFAULT_MAX_ZOOM } from './MapLibre';

const NOOP = () => {};

interface ClusterProperties {
  metric: number;
  sum: number;
  squaredSum: number;
  min: number;
  max: number;
}

export default function transformProps(chartProps: ChartProps) {
  const { width, height, formData, hooks, queriesData } = chartProps;
  const { onError = NOOP, setControlValue = NOOP } = hooks;
  const { bounds, geoJSON, hasCustomMetric } = queriesData[0].data;
  const {
    clusteringRadius,
    globalOpacity,
    maplibreColor,
    maplibreStyle,
    pandasAggfunc,
    pointRadiusUnit,
    renderWhileDragging,
  } = formData;

  // Validate color
  const rgb = /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/.exec(
    maplibreColor,
  );
  if (rgb === null) {
    onError("Color field must be of form 'rgb(%d, %d, %d)'");

    return {};
  }

  const opts: SuperclusterOptions<ClusterProperties, ClusterProperties> = {
    maxZoom: DEFAULT_MAX_ZOOM,
    radius: clusteringRadius,
  };
  if (hasCustomMetric) {
    opts.map = (prop: ClusterProperties) => ({
      metric: prop.metric,
      sum: prop.metric,
      squaredSum: prop.metric ** 2,
      min: prop.metric,
      max: prop.metric,
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
    mapStyle: maplibreStyle,
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

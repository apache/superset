"use strict";

exports.__esModule = true;
exports.default = transformProps;

var _supercluster = _interopRequireDefault(require("supercluster"));

var _MapBox = require("./MapBox");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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
const NOOP = () => {};

function transformProps(chartProps) {
  const {
    width,
    height,
    formData,
    hooks,
    queryData
  } = chartProps;
  const {
    onError = NOOP,
    setControlValue = NOOP
  } = hooks;
  const {
    bounds,
    geoJSON,
    hasCustomMetric,
    mapboxApiKey
  } = queryData.data;
  const {
    clusteringRadius,
    globalOpacity,
    mapboxColor,
    mapboxStyle,
    pandasAggfunc,
    pointRadius,
    pointRadiusUnit,
    renderWhileDragging
  } = formData; // Validate mapbox color

  const rgb = /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/.exec(mapboxColor);

  if (rgb === null) {
    onError("Color field must be of form 'rgb(%d, %d, %d)'");
    return {};
  }

  const opts = {
    maxZoom: _MapBox.DEFAULT_MAX_ZOOM,
    radius: clusteringRadius
  };

  if (hasCustomMetric) {
    opts.initial = () => ({
      sum: 0,
      squaredSum: 0,
      min: Infinity,
      max: -Infinity
    });

    opts.map = prop => ({
      sum: prop.metric,
      squaredSum: prop.metric ** 2,
      min: prop.metric,
      max: prop.metric
    });

    opts.reduce = (accu, prop) => {
      // Temporarily disable param-reassignment linting to work with supercluster's api

      /* eslint-disable no-param-reassign */
      accu.sum += prop.sum;
      accu.squaredSum += prop.squaredSum;
      accu.min = Math.min(accu.min, prop.min);
      accu.max = Math.max(accu.max, prop.max);
      /* eslint-enable no-param-reassign */
    };
  }

  const clusterer = (0, _supercluster.default)(opts);
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

    onViewportChange({
      latitude,
      longitude,
      zoom
    }) {
      setControlValue('viewport_longitude', longitude);
      setControlValue('viewport_latitude', latitude);
      setControlValue('viewport_zoom', zoom);
    },

    pointRadius: pointRadius === 'Auto' ? _MapBox.DEFAULT_POINT_RADIUS : pointRadius,
    pointRadiusUnit,
    renderWhileDragging,
    rgb
  };
}
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
/* eslint-disable react/jsx-sort-default-props, react/sort-prop-types */
/* eslint-disable react/forbid-prop-types, react/require-default-props */

import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import MapGL from 'react-map-gl';
import ViewportMercator from 'viewport-mercator-project';
import ScatterPlotGlowOverlay from './ScatterPlotGlowOverlay';
import './MapBox.css';

const NOOP = () => {};
export const DEFAULT_MAX_ZOOM = 16;
export const DEFAULT_POINT_RADIUS = 60;

const propTypes = {
  width: PropTypes.number,
  height: PropTypes.number,
  aggregatorName: PropTypes.string,
  clusterer: PropTypes.object,
  globalOpacity: PropTypes.number,
  hasCustomMetric: PropTypes.bool,
  mapStyle: PropTypes.string,
  mapboxApiKey: PropTypes.string.isRequired,
  onViewportChange: PropTypes.func,
  pointRadius: PropTypes.number,
  pointRadiusUnit: PropTypes.string,
  renderWhileDragging: PropTypes.bool,
  rgb: PropTypes.array,
  bounds: PropTypes.array,
};

const defaultProps = {
  width: 400,
  height: 400,
  globalOpacity: 1,
  onViewportChange: NOOP,
  pointRadius: DEFAULT_POINT_RADIUS,
  pointRadiusUnit: 'Pixels',
};

const MapBox = (props) => {
const { width, height, bounds } = props;
    const mercator = new ViewportMercator({
      width,
      height,
    }).fitBounds(bounds);
    const { latitude, longitude, zoom } = mercator;

    const [viewport, setViewport] = useState({
        longitude,
        latitude,
        zoom,
      });

    const handleViewportChangeHandler = useCallback((viewport) => {
    setViewport(viewport);
    const { onViewportChange } = props;
    onViewportChange(viewport);
  }, [viewport]);

    const {
      width,
      height,
      aggregatorName,
      clusterer,
      globalOpacity,
      mapStyle,
      mapboxApiKey,
      pointRadius,
      pointRadiusUnit,
      renderWhileDragging,
      rgb,
      hasCustomMetric,
      bounds,
    } = props;
    
    const isDragging =
      viewport.isDragging === undefined ? false : viewport.isDragging;

    // Compute the clusters based on the original bounds and current zoom level. Note when zoom/pan
    // to an area outside of the original bounds, no additional queries are made to the backend to
    // retrieve additional data.
    // add this variable to widen the visible area
    const offsetHorizontal = (width * 0.5) / 100;
    const offsetVertical = (height * 0.5) / 100;
    const bbox = [
      bounds[0][0] - offsetHorizontal,
      bounds[0][1] - offsetVertical,
      bounds[1][0] + offsetHorizontal,
      bounds[1][1] + offsetVertical,
    ];
    const clusters = clusterer.getClusters(bbox, Math.round(viewport.zoom));

    return (
      <MapGL
        {...viewport}
        mapStyle={mapStyle}
        width={width}
        height={height}
        mapboxApiAccessToken={mapboxApiKey}
        onViewportChange={handleViewportChangeHandler}
        preserveDrawingBuffer
      >
        <ScatterPlotGlowOverlay
          {...viewport}
          isDragging={isDragging}
          locations={clusters}
          dotRadius={pointRadius}
          pointRadiusUnit={pointRadiusUnit}
          rgb={rgb}
          globalOpacity={globalOpacity}
          compositeOperation="screen"
          renderWhileDragging={renderWhileDragging}
          aggregation={hasCustomMetric ? aggregatorName : null}
          lngLatAccessor={location => {
            const { coordinates } = location.geometry;

            return [coordinates[0], coordinates[1]];
          }}
        />
      </MapGL>
    ); 
};




MapBox.propTypes = propTypes;
MapBox.defaultProps = defaultProps;

export default MapBox;

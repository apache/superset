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
import { useEffect } from 'react';
import PropTypes from 'prop-types';
import MapGL from 'react-map-gl';
import { WebMercatorViewport } from '@math.gl/web-mercator';
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
  viewportLongitude: PropTypes.number,
  viewportLatitude: PropTypes.number,
  viewportZoom: PropTypes.number,
  initialViewportSettings: PropTypes.oneOf(['Auto', 'Fixed']),
};

const defaultProps = {
  width: 400,
  height: 400,
  globalOpacity: 1,
  onViewportChange: NOOP,
  pointRadius: DEFAULT_POINT_RADIUS,
  pointRadiusUnit: 'Pixels',
};

const isEmpty = v => v === undefined || v === null || v === '';

const MapBox = props => {
  const {
    width,
    height,
    bounds,
    viewportLongitude,
    viewportLatitude,
    viewportZoom,
    initialViewportSettings,
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
    onViewportChange,
  } = props;

  const [viewport, setViewport] = React.useState();
  // ++
  const [clusters, setClusters] = React.useState();

  useEffect(() => {
    // Get a viewport that fits the given bounds, which all marks to be clustered.
    // Derive lat, lon and zoom from this viewport. This is only done on initial
    // render as the bounds don't update as we pan/zoom in the current design.
    const mercator = new WebMercatorViewport({
      width,
      height,
    }).fitBounds(bounds);
    const { latitude, longitude, zoom } = mercator;

    if (initialViewportSettings === 'Fixed') {
      setViewport({
        longitude: !isEmpty(viewportLongitude) ? viewportLongitude : longitude,
        latitude: !isEmpty(viewportLatitude) ? viewportLatitude : latitude,
        zoom: !isEmpty(viewportZoom) ? viewportZoom : zoom,
      });
    } else {
      setViewport({
        longitude,
        latitude,
        zoom,
      });
    }
  }, []);

  // ++
  useEffect(() => {
    // -- const clusters = useMemo(() => {
    if (viewport) {
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
      // ++
      setClusters(clusterer.getClusters(bbox, Math.round(viewport.zoom)));
      // -- return clusterer.getClusters(bbox, Math.round(viewport.zoom));
    }
  }, [clusterer, viewport, bounds, width, height]);
  // --  return undefined;
  // -- }, [viewport, clusterer, bounds, width, height]);

  if (!viewport || !clusters) {
    return <></>;
  }

  const isDragging = Boolean(viewport.isDragging);

  const handleViewportChange = newViewport => {
    setViewport(newViewport);
    onViewportChange(newViewport);
  };

  return (
    <MapGL
      {...viewport}
      mapStyle={mapStyle}
      width={width}
      height={height}
      mapboxApiAccessToken={mapboxApiKey}
      onViewportChange={handleViewportChange}
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

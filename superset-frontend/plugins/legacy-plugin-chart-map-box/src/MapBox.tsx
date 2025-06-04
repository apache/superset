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
import { Component } from 'react';
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
};

const defaultProps = {
  width: 400,
  height: 400,
  globalOpacity: 1,
  onViewportChange: NOOP,
  pointRadius: DEFAULT_POINT_RADIUS,
  pointRadiusUnit: 'Pixels',
};

class MapBox extends Component {
  constructor(props: $TSFixMe) {
    super(props);

    // @ts-expect-error TS(2339): Property 'width' does not exist on type 'Readonly<... Remove this comment to see the full error message
    const { width, height, bounds } = this.props;
    // Get a viewport that fits the given bounds, which all marks to be clustered.
    // Derive lat, lon and zoom from this viewport. This is only done on initial
    // render as the bounds don't update as we pan/zoom in the current design.
    const mercator = new WebMercatorViewport({
      width,
      height,
    }).fitBounds(bounds);
    const { latitude, longitude, zoom } = mercator;

    this.state = {
      viewport: {
        longitude,
        latitude,
        zoom,
      },
    };
    this.handleViewportChange = this.handleViewportChange.bind(this);
  }

  handleViewportChange(viewport: $TSFixMe) {
    this.setState({ viewport });
    // @ts-expect-error TS(2339): Property 'onViewportChange' does not exist on type... Remove this comment to see the full error message
    const { onViewportChange } = this.props;
    onViewportChange(viewport);
  }

  render() {
    const {
      // @ts-expect-error TS(2339): Property 'width' does not exist on type 'Readonly<... Remove this comment to see the full error message
      width,
      // @ts-expect-error TS(2339): Property 'height' does not exist on type 'Readonly... Remove this comment to see the full error message
      height,
      // @ts-expect-error TS(2339): Property 'aggregatorName' does not exist on type '... Remove this comment to see the full error message
      aggregatorName,
      // @ts-expect-error TS(2339): Property 'clusterer' does not exist on type 'Reado... Remove this comment to see the full error message
      clusterer,
      // @ts-expect-error TS(2339): Property 'globalOpacity' does not exist on type 'R... Remove this comment to see the full error message
      globalOpacity,
      // @ts-expect-error TS(2339): Property 'mapStyle' does not exist on type 'Readon... Remove this comment to see the full error message
      mapStyle,
      // @ts-expect-error TS(2339): Property 'mapboxApiKey' does not exist on type 'Re... Remove this comment to see the full error message
      mapboxApiKey,
      // @ts-expect-error TS(2339): Property 'pointRadius' does not exist on type 'Rea... Remove this comment to see the full error message
      pointRadius,
      // @ts-expect-error TS(2339): Property 'pointRadiusUnit' does not exist on type ... Remove this comment to see the full error message
      pointRadiusUnit,
      // @ts-expect-error TS(2339): Property 'renderWhileDragging' does not exist on t... Remove this comment to see the full error message
      renderWhileDragging,
      // @ts-expect-error TS(2339): Property 'rgb' does not exist on type 'Readonly<{}... Remove this comment to see the full error message
      rgb,
      // @ts-expect-error TS(2339): Property 'hasCustomMetric' does not exist on type ... Remove this comment to see the full error message
      hasCustomMetric,
      // @ts-expect-error TS(2339): Property 'bounds' does not exist on type 'Readonly... Remove this comment to see the full error message
      bounds,
    } = this.props;
    // @ts-expect-error TS(2339): Property 'viewport' does not exist on type 'Readon... Remove this comment to see the full error message
    const { viewport } = this.state;
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
        onViewportChange={this.handleViewportChange}
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
          lngLatAccessor={(location: $TSFixMe) => {
            const { coordinates } = location.geometry;

            return [coordinates[0], coordinates[1]];
          }}
        />
      </MapGL>
    );
  }
}

// @ts-expect-error TS(2339): Property 'propTypes' does not exist on type 'typeo... Remove this comment to see the full error message
MapBox.propTypes = propTypes;
// @ts-expect-error TS(2339): Property 'defaultProps' does not exist on type 'ty... Remove this comment to see the full error message
MapBox.defaultProps = defaultProps;

export default MapBox;

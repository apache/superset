// @flow
// Copyright (c) 2015 Uber Technologies, Inc.

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
import React, {PureComponent, createRef} from 'react';
import PropTypes from 'prop-types';

import {normalizeStyle} from '../utils/style-utils';

import WebMercatorViewport from 'viewport-mercator-project';
import AutoSizer from 'react-virtualized-auto-sizer';

import Mapbox from '../mapbox/mapbox';
import mapboxgl from '../utils/mapboxgl';
import {checkVisibilityConstraints} from '../utils/map-constraints';
import {MAPBOX_LIMITS} from '../utils/map-state';
import MapContext from './map-context';

import type {ViewState} from '../mapbox/mapbox';

/* eslint-disable max-len */
const TOKEN_DOC_URL =
  'https://uber.github.io/react-map-gl/#/Documentation/getting-started/about-mapbox-tokens';
const NO_TOKEN_WARNING = 'A valid API access token is required to use Mapbox data';
/* eslint-disable max-len */

function noop() {}

const UNAUTHORIZED_ERROR_CODE = 401;

const CONTAINER_STYLE = {
  position: 'absolute',
  width: '100%',
  height: '100%',
  overflow: 'hidden'
};

const propTypes = Object.assign({}, Mapbox.propTypes, {
  /** The dimensions of the map **/
  width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),

  /** Callback when map size changes **/
  onResize: PropTypes.func,
  /** There are known issues with style diffing. As stopgap, add option to prevent style diffing. */
  preventStyleDiffing: PropTypes.bool,
  /** Hide invalid token warning even if request fails */
  disableTokenWarning: PropTypes.bool,
  /** Whether the map is visible */
  visible: PropTypes.bool,
  /** Custom class name for the map */
  className: PropTypes.string,
  /** Custom CSS for the container */
  style: PropTypes.object,

  /** Advanced features */
  // Contraints for displaying the map. If not met, then the map is hidden.
  // Experimental! May be changed in minor version updates.
  visibilityConstraints: PropTypes.object
});

const defaultProps = Object.assign({}, Mapbox.defaultProps, {
  preventStyleDiffing: false,
  disableTokenWarning: false,
  visible: true,
  onResize: noop,
  className: '',
  style: null,
  visibilityConstraints: MAPBOX_LIMITS
});

export type StaticMapProps = {
  gl?: any,
  width: number | string,
  height: number | string,
  preventStyleDiffing: boolean,
  disableTokenWarning: boolean,
  visible: boolean,
  className: string,
  style: any,
  visibilityConstraints: any,
  children?: any,
  onLoad: Function,
  onError: Function,
  onResize: Function,
  mapStyle: any,
  visible: boolean,
  viewState?: ViewState,
  longitude: number,
  latitude: number,
  zoom: number,
  bearing: number,
  pitch: number,
  altitude?: number
};

type State = {
  accessTokenInvalid: boolean
};

export default class StaticMap extends PureComponent<StaticMapProps, State> {
  static supported() {
    return mapboxgl && mapboxgl.supported();
  }

  static propTypes: any = propTypes;
  static defaultProps: StaticMapProps = defaultProps;

  state: State = {
    accessTokenInvalid: false
  };

  componentDidMount() {
    if (!StaticMap.supported()) {
      return;
    }
    const {mapStyle} = this.props;

    this._mapbox = new Mapbox(
      // $FlowFixMe
      Object.assign({}, this.props, {
        mapboxgl, // Handle to mapbox-gl library
        width: this._width,
        height: this._height,
        container: this._mapboxMapRef.current,
        onError: this._mapboxMapError,
        mapStyle: normalizeStyle(mapStyle)
      })
    );
    this._map = this._mapbox.getMap();
  }

  componentDidUpdate(prevProps: StaticMapProps) {
    if (this._mapbox) {
      this._updateMapStyle(prevProps, this.props);
      this._updateMapProps(this.props);
    }
  }

  componentWillUnmount() {
    if (this._mapbox) {
      this._mapbox.finalize();
      this._mapbox = null;
      this._map = null;
    }
  }

  _mapbox: any = null;
  _map: any = null;
  _mapboxMapRef: {current: null | HTMLDivElement} = createRef();
  _mapContainerRef: {current: null | HTMLDivElement} = createRef();
  _queryParams: any = {};
  _width: number = 0;
  _height: number = 0;

  // External apps can access map this way
  getMap = () => {
    return this._map;
  };

  /** Uses Mapbox's
   * queryRenderedFeatures API to find features at point or in a bounding box.
   * https://www.mapbox.com/mapbox-gl-js/api/#Map#queryRenderedFeatures
   * To query only some of the layers, set the `interactive` property in the
   * layer style to `true`.
   * @param {[Number, Number]|[[Number, Number], [Number, Number]]} geometry -
   *   Point or an array of two points defining the bounding box
   * @param {Object} options - query options
   */
  queryRenderedFeatures = (geometry: any, options: any = {}) => {
    return this._map.queryRenderedFeatures(geometry, options);
  };

  // Note: needs to be called after render (e.g. in componentDidUpdate)
  _updateMapSize(width: number, height: number) {
    if (this._width !== width || this._height !== height) {
      this._width = width;
      this._height = height;
      this._updateMapProps(this.props);
    }
  }

  _updateMapStyle(oldProps: StaticMapProps, newProps: StaticMapProps) {
    const mapStyle = newProps.mapStyle;
    const oldMapStyle = oldProps.mapStyle;
    if (mapStyle !== oldMapStyle) {
      this._map.setStyle(normalizeStyle(mapStyle), {
        diff: !this.props.preventStyleDiffing
      });
    }
  }

  _updateMapProps(props: StaticMapProps) {
    if (!this._mapbox) {
      return;
    }
    this._mapbox.setProps(
      Object.assign({}, props, {
        width: this._width,
        height: this._height
      })
    );
  }

  // Handle map error
  _mapboxMapError = (evt: {
    error?: {
      message: string,
      status: number
    },
    status: number
  }) => {
    const statusCode = (evt.error && evt.error.status) || evt.status;
    if (statusCode === UNAUTHORIZED_ERROR_CODE && !this.state.accessTokenInvalid) {
      // Mapbox throws unauthorized error - invalid token
      console.error(NO_TOKEN_WARNING); // eslint-disable-line
      this.setState({accessTokenInvalid: true});
    }
    this.props.onError(evt);
  };

  _renderNoTokenWarning() {
    if (this.state.accessTokenInvalid && !this.props.disableTokenWarning) {
      const style = {
        position: 'absolute',
        left: 0,
        top: 0
      };
      return (
        <div key="warning" id="no-token-warning" style={style}>
          <h3 key="header">NO_TOKEN_WARNING</h3>
          <div key="text">For information on setting up your basemap, read</div>
          <a key="link" href={TOKEN_DOC_URL}>
            Note on Map Tokens
          </a>
        </div>
      );
    }

    return null;
  }

  _renderOverlays(dimensions: {width?: number, height?: number}) {
    const {width = Number(this.props.width), height = Number(this.props.height)} = dimensions;
    this._updateMapSize(width, height);

    return (
      <MapContext.Consumer>
        {interactiveContext => {
          const context = {
            ...interactiveContext,
            // $FlowFixMe
            viewport: new WebMercatorViewport({
              ...this.props,
              ...this.props.viewState,
              width,
              height
            }),
            map: this._map,
            mapContainer: interactiveContext.mapContainer || this._mapContainerRef.current
          };
          return (
            <MapContext.Provider value={context}>
              <div key="map-overlays" className="overlays" style={CONTAINER_STYLE}>
                {this.props.children}
              </div>
            </MapContext.Provider>
          );
        }}
      </MapContext.Consumer>
    );
  }

  render() {
    const {className, width, height, style, visibilityConstraints} = this.props;
    const mapContainerStyle = Object.assign({position: 'relative'}, style, {
      width,
      height
    });

    const visible =
      this.props.visible &&
      checkVisibilityConstraints(this.props.viewState || this.props, visibilityConstraints);

    const mapStyle = Object.assign({}, CONTAINER_STYLE, {
      visibility: visible ? 'inherit' : 'hidden'
    });

    return (
      <div key="map-container" style={mapContainerStyle} ref={this._mapContainerRef}>
        <div key="map-mapbox" ref={this._mapboxMapRef} style={mapStyle} className={className} />
        {/* AutoSizer is a pure component and does not rerender when map props change */}
        {/* rebind the callback so that it's triggered every render pass */}
        <AutoSizer
          key="autosizer"
          disableWidth={Number.isFinite(width)}
          disableHeight={Number.isFinite(height)}
          onResize={this.props.onResize}
        >
          {this._renderOverlays.bind(this)}
        </AutoSizer>
        {this._renderNoTokenWarning()}
      </div>
    );
  }
}

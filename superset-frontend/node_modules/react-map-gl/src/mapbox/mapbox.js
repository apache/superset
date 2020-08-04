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

/* global window, process, HTMLCanvasElement */
import PropTypes from 'prop-types';
import {document} from '../utils/globals';

function noop() {}

function defaultOnError(event?: {error: any}) {
  if (event) {
    console.error(event.error); // eslint-disable-line
  }
}

const propTypes = {
  // Creation parameters
  container: PropTypes.object /** The container to have the map. */,
  gl: PropTypes.object /** External WebGLContext to use */,

  mapboxApiAccessToken: PropTypes.string /** Mapbox API access token for Mapbox tiles/styles. */,
  mapboxApiUrl: PropTypes.string,
  attributionControl: PropTypes.bool /** Show attribution control or not. */,
  preserveDrawingBuffer: PropTypes.bool /** Useful when you want to export the canvas as a PNG. */,
  reuseMaps: PropTypes.bool,
  transformRequest: PropTypes.func /** The transformRequest callback for the map */,
  mapOptions: PropTypes.object /** Extra options to pass to Mapbox constructor. See #545. **/,
  mapStyle: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.object
  ]) /** The Mapbox style. A string url to a MapboxGL style */,

  visible: PropTypes.bool /** Whether the map is visible */,
  asyncRender: PropTypes.bool /** Whether mapbox should manage its own render cycle */,

  onLoad: PropTypes.func /** The onLoad callback for the map */,
  onError: PropTypes.func /** The onError callback for the map */,

  // Map view state
  width: PropTypes.number /** The width of the map. */,
  height: PropTypes.number /** The height of the map. */,

  viewState: PropTypes.object /** object containing lng/lat/zoom/bearing/pitch */,

  longitude: PropTypes.number /** The longitude of the center of the map. */,
  latitude: PropTypes.number /** The latitude of the center of the map. */,
  zoom: PropTypes.number /** The tile zoom level of the map. */,
  bearing: PropTypes.number /** Specify the bearing of the viewport */,
  pitch: PropTypes.number /** Specify the pitch of the viewport */,
  // Note: Non-public API, see https://github.com/mapbox/mapbox-gl-js/issues/1137
  altitude: PropTypes.number /** Altitude of the viewport camera. Default 1.5 "screen heights" */
};

const defaultProps = {
  container: document.body,
  mapboxApiAccessToken: getAccessToken(),
  mapboxApiUrl: 'https://api.mapbox.com',
  preserveDrawingBuffer: false,
  attributionControl: true,
  reuseMaps: false,
  mapOptions: {},
  mapStyle: 'mapbox://styles/mapbox/light-v8',

  visible: true,
  asyncRender: false,

  onLoad: noop,
  onError: defaultOnError,

  width: 0,
  height: 0,
  longitude: 0,
  latitude: 0,
  zoom: 0,
  bearing: 0,
  pitch: 0
};

type MapboxGL = {
  version: string,
  accessToken: string,
  baseApiUrl: string,
  Map: Function
};

export type ViewState = {
  longitude: number,
  latitude: number,
  zoom: number,
  bearing: number,
  pitch: number,
  altitude?: number
};

type Props = {
  mapboxgl?: MapboxGL,
  container: any,
  gl?: any,
  mapboxApiAccessToken: string,
  mapboxApiUrl: string,
  attributionControl: boolean,
  preserveDrawingBuffer: boolean,
  onLoad: Function,
  onError: Function,
  reuseMaps: boolean,
  transformRequest?: Function,
  mapStyle: any,
  visible: boolean,
  asyncRender: boolean,
  width: number,
  height: number,
  viewState?: ViewState,
  longitude: number,
  latitude: number,
  zoom: number,
  bearing: number,
  pitch: number,
  altitude?: number,
  mapOptions: any
};

// Try to get access token from URL, env, local storage or config
export function getAccessToken(): string {
  let accessToken = null;

  if (typeof window !== 'undefined' && window.location) {
    const match = window.location.search.match(/access_token=([^&\/]*)/);
    accessToken = match && match[1];
  }

  if (!accessToken && typeof process !== 'undefined') {
    // Note: This depends on bundler plugins (e.g. webpack) importing environment correctly
    accessToken =
      accessToken || process.env.MapboxAccessToken || process.env.REACT_APP_MAPBOX_ACCESS_TOKEN; // eslint-disable-line
  }

  // Prevents mapbox from throwing
  return accessToken || 'no-token';
}

// Helper function to merge defaultProps and check prop types
function checkPropTypes(props, component = 'component') {
  // TODO - check for production (unless done by prop types package?)
  if (props.debug) {
    PropTypes.checkPropTypes(propTypes, props, 'prop', component);
  }
}

// A small wrapper class for mapbox-gl
// - Provides a prop style interface (that can be trivially used by a React wrapper)
// - Makes sure mapbox doesn't crash under Node
// - Handles map reuse (to work around Mapbox resource leak issues)
// - Provides support for specifying tokens during development

export default class Mapbox {
  static initialized: boolean = false;
  static propTypes: any = propTypes;
  static defaultProps: any = defaultProps;
  static savedMap: any = null;

  constructor(props: Props) {
    if (!props.mapboxgl) {
      throw new Error('Mapbox not available');
    }

    this.mapboxgl = props.mapboxgl;

    if (!Mapbox.initialized) {
      Mapbox.initialized = true;

      // Version detection using babel plugin
      // $FlowFixMe
      // const VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'untranspiled source';
      // TODO - expose version for debug

      this._checkStyleSheet(this.mapboxgl.version);
    }

    this._initialize(props);
  }

  mapboxgl: MapboxGL;
  props: Props = defaultProps;
  _map: any = null;
  width: number = 0;
  height: number = 0;

  finalize() {
    this._destroy();
    return this;
  }

  setProps(props: Props) {
    this._update(this.props, props);
    return this;
  }

  // Mapbox's map.resize() reads size from DOM, so DOM element must already be resized
  // In a system like React we must wait to read size until after render
  // (e.g. until "componentDidUpdate")
  resize() {
    this._map.resize();
    return this;
  }

  // Force redraw the map now. Typically resize() and jumpTo() is reflected in the next
  // render cycle, which is managed by Mapbox's animation loop.
  // This removes the synchronization issue caused by requestAnimationFrame.
  redraw() {
    const map = this._map;
    // map._render will throw error if style does not exist
    // https://github.com/mapbox/mapbox-gl-js/blob/fb9fc316da14e99ff4368f3e4faa3888fb43c513
    //   /src/ui/map.js#L1834
    if (map.style) {
      // cancel the scheduled update
      if (map._frame) {
        map._frame.cancel();
        map._frame = null;
      }
      // the order is important - render() may schedule another update
      map._render();
    }
  }

  // External apps can access map this way
  getMap() {
    return this._map;
  }

  // PRIVATE API
  _fireLoadEvent = () => {
    this.props.onLoad({
      type: 'load',
      target: this._map
    });
  };

  _reuse(props: Props) {
    this._map = Mapbox.savedMap;
    // When reusing the saved map, we need to reparent the map(canvas) and other child nodes
    // intoto the new container from the props.
    // Step1: reparenting child nodes from old container to new container
    const oldContainer = this._map.getContainer();
    const newContainer = props.container;
    newContainer.classList.add('mapboxgl-map');
    while (oldContainer.childNodes.length > 0) {
      newContainer.appendChild(oldContainer.childNodes[0]);
    }
    // Step2: replace the internal container with new container from the react component
    this._map._container = newContainer;
    Mapbox.savedMap = null;

    // Step3: update style and call onload again
    if (props.mapStyle) {
      this._map.setStyle(props.mapStyle, {
        // From the user's perspective, there's no "diffing" on initialization
        // We always rebuild the style from scratch when creating a new Mapbox instance
        diff: false
      });
    }

    // call onload event handler after style fully loaded when style needs update
    if (this._map.isStyleLoaded()) {
      this._fireLoadEvent();
    } else {
      this._map.once('styledata', this._fireLoadEvent);
    }
  }

  _create(props: Props) {
    // Reuse a saved map, if available
    if (props.reuseMaps && Mapbox.savedMap) {
      this._reuse(props);
    } else {
      if (props.gl) {
        const getContext = HTMLCanvasElement.prototype.getContext;
        // Hijack canvas.getContext to return our own WebGLContext
        // This will be called inside the mapboxgl.Map constructor
        // $FlowFixMe
        HTMLCanvasElement.prototype.getContext = () => {
          // Unhijack immediately
          // $FlowFixMe
          HTMLCanvasElement.prototype.getContext = getContext;
          return props.gl;
        };
      }

      const mapOptions: any = {
        container: props.container,
        center: [0, 0],
        zoom: 8,
        pitch: 0,
        bearing: 0,
        maxZoom: 24,
        style: props.mapStyle,
        interactive: false,
        trackResize: false,
        attributionControl: props.attributionControl,
        preserveDrawingBuffer: props.preserveDrawingBuffer
      };
      // We don't want to pass a null or no-op transformRequest function.
      if (props.transformRequest) {
        mapOptions.transformRequest = props.transformRequest;
      }
      this._map = new this.mapboxgl.Map(Object.assign({}, mapOptions, props.mapOptions));

      // Attach optional onLoad function
      this._map.once('load', props.onLoad);
      this._map.on('error', props.onError);
    }

    return this;
  }

  _destroy() {
    if (!this._map) {
      return;
    }

    if (!Mapbox.savedMap) {
      Mapbox.savedMap = this._map;

      // deregister the mapbox event listeners
      this._map.off('load', this.props.onLoad);
      this._map.off('error', this.props.onError);
      this._map.off('styledata', this._fireLoadEvent);
    } else {
      this._map.remove();
    }

    this._map = null;
  }

  _initialize(props: Props) {
    props = Object.assign({}, defaultProps, props);
    checkPropTypes(props, 'Mapbox');

    // Creation only props
    this.mapboxgl.accessToken = props.mapboxApiAccessToken || defaultProps.mapboxApiAccessToken;
    this.mapboxgl.baseApiUrl = props.mapboxApiUrl;

    this._create(props);

    // Hijack dimension properties
    // This eliminates the timing issue between calling resize() and DOM update
    /* eslint-disable accessor-pairs */
    const {container} = props;
    // $FlowFixMe
    Object.defineProperty(container, 'offsetWidth', {get: () => this.width});
    // $FlowFixMe
    Object.defineProperty(container, 'clientWidth', {get: () => this.width});
    // $FlowFixMe
    Object.defineProperty(container, 'offsetHeight', {
      get: () => this.height
    });
    // $FlowFixMe
    Object.defineProperty(container, 'clientHeight', {
      get: () => this.height
    });

    // Disable outline style
    const canvas = this._map.getCanvas();
    if (canvas) {
      canvas.style.outline = 'none';
    }

    this._updateMapViewport({}, props);
    this._updateMapSize({}, props);

    this.props = props;
  }

  _update(oldProps: Props, newProps: Props) {
    if (!this._map) {
      return;
    }

    newProps = Object.assign({}, this.props, newProps);
    checkPropTypes(newProps, 'Mapbox');

    const viewportChanged = this._updateMapViewport(oldProps, newProps);
    const sizeChanged = this._updateMapSize(oldProps, newProps);

    if (!newProps.asyncRender && (viewportChanged || sizeChanged)) {
      this.redraw();
    }

    this.props = newProps;
  }

  // Note: needs to be called after render (e.g. in componentDidUpdate)
  _updateMapSize(oldProps: any, newProps: Props) {
    const sizeChanged = oldProps.width !== newProps.width || oldProps.height !== newProps.height;
    if (sizeChanged) {
      this.width = newProps.width;
      this.height = newProps.height;
      this.resize();
    }
    return sizeChanged;
  }

  _updateMapViewport(oldProps: any, newProps: Props) {
    const oldViewState = this._getViewState(oldProps);
    const newViewState = this._getViewState(newProps);

    const viewportChanged =
      newViewState.latitude !== oldViewState.latitude ||
      newViewState.longitude !== oldViewState.longitude ||
      newViewState.zoom !== oldViewState.zoom ||
      newViewState.pitch !== oldViewState.pitch ||
      newViewState.bearing !== oldViewState.bearing ||
      newViewState.altitude !== oldViewState.altitude;

    if (viewportChanged) {
      this._map.jumpTo(this._viewStateToMapboxProps(newViewState));

      // TODO - jumpTo doesn't handle altitude
      if (newViewState.altitude !== oldViewState.altitude) {
        this._map.transform.altitude = newViewState.altitude;
      }
    }
    return viewportChanged;
  }

  _getViewState(props: Props): ViewState {
    const {longitude, latitude, zoom, pitch = 0, bearing = 0, altitude = 1.5} =
      props.viewState || props;
    return {longitude, latitude, zoom, pitch, bearing, altitude};
  }

  _checkStyleSheet(mapboxVersion: string = '0.47.0') {
    if (typeof document === 'undefined') {
      return;
    }

    // check mapbox styles
    try {
      const testElement = document.createElement('div');
      testElement.className = 'mapboxgl-map';
      testElement.style.display = 'none';
      document.body.append(testElement);
      const isCssLoaded = window.getComputedStyle(testElement).position !== 'static';

      if (!isCssLoaded) {
        // attempt to insert mapbox stylesheet
        const link = document.createElement('link');
        link.setAttribute('rel', 'stylesheet');
        link.setAttribute('type', 'text/css');
        link.setAttribute(
          'href',
          `https://api.tiles.mapbox.com/mapbox-gl-js/v${mapboxVersion}/mapbox-gl.css`
        );
        document.head.append(link);
      }
    } catch (error) {
      // do nothing
    }
  }

  _viewStateToMapboxProps(viewState: ViewState) {
    return {
      center: [viewState.longitude, viewState.latitude],
      zoom: viewState.zoom,
      bearing: viewState.bearing,
      pitch: viewState.pitch
    };
  }
}

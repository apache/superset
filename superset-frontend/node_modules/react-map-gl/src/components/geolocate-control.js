// @flow

/* global window */
import React, {createRef} from 'react';
import PropTypes from 'prop-types';
import WebMercatorViewport from 'viewport-mercator-project';

import mapboxgl from '../utils/mapboxgl';

import BaseControl from './base-control';
import Marker from './marker';
import MapState from '../utils/map-state';
import TransitionManager from '../utils/transition-manager';
import {isGeolocationSupported} from '../utils/geolocate-utils';

import type {BaseControlProps} from './base-control';

const LINEAR_TRANSITION_PROPS = Object.assign({}, TransitionManager.defaultProps, {
  transitionDuration: 500
});

const noop = () => {};

const propTypes = Object.assign({}, BaseControl.propTypes, {
  // Custom className
  className: PropTypes.string,
  style: PropTypes.object,

  // mapbox geolocate options
  // https://docs.mapbox.com/mapbox-gl-js/api/#geolocatecontrol
  positionOptions: PropTypes.object,
  fitBoundsOptions: PropTypes.object,
  trackUserLocation: PropTypes.bool,
  showUserLocation: PropTypes.bool,

  // Callbacks fired when the user interacted with the map. The object passed to the callbacks
  // contains viewport properties such as `longitude`, `latitude`, `zoom` etc.
  onViewStateChange: PropTypes.func,
  onViewportChange: PropTypes.func
});

const defaultProps = Object.assign({}, BaseControl.defaultProps, {
  className: '',
  style: {},

  // mapbox geolocate options
  positionOptions: null,
  fitBoundsOptions: null,
  trackUserLocation: false,
  showUserLocation: true
});

export type GeolocateControlProps = BaseControlProps & {
  className: string,
  style: Object,
  positionOptions: any,
  fitBoundsOptions: any,
  trackUserLocation: boolean,
  showUserLocation: boolean,
  onViewStateChange?: Function,
  onViewportChange?: Function
};

type Coordinate = {
  longitude: number,
  latitude: number,
  accuracy: number
};
type Position = {
  coords: Coordinate
};
type State = {
  supportsGeolocation: boolean,
  markerPosition: ?Coordinate
};

export default class GeolocateControl extends BaseControl<
  GeolocateControlProps,
  State,
  HTMLDivElement
> {
  static propTypes = propTypes;
  static defaultProps = defaultProps;

  state = {
    supportsGeolocation: false,
    markerPosition: null
  };

  _mapboxGeolocateControl: any = null;

  _geolocateButtonRef: {current: null | HTMLButtonElement} = createRef();
  _markerRef: {current: null | Marker} = createRef();

  componentDidMount() {
    isGeolocationSupported().then(result => {
      this.setState({supportsGeolocation: result});
      this._setupMapboxGeolocateControl(result);
    });
  }

  componentDidUpdate() {
    // MapboxGeolocateControl needs manipulate the style of Marker's container
    const markerRef = this._markerRef.current;
    if (this._mapboxGeolocateControl && markerRef) {
      this._mapboxGeolocateControl._dotElement = markerRef._containerRef.current;
    }
  }

  componentWillUnmount() {
    // re-implement MapboxGeolocateControl's _onRemove
    // clear the geolocation watch if exists
    const geolocationWatchID = this._mapboxGeolocateControl._geolocationWatchID;
    if (geolocationWatchID !== undefined) {
      window.navigator.geolocation.clearWatch(geolocationWatchID);
      this._mapboxGeolocateControl._geolocationWatchID = undefined;
    }
  }

  _setupMapboxGeolocateControl = (supportsGeolocation: boolean) => {
    if (!supportsGeolocation) {
      /* eslint-disable no-console, no-undef */
      console.warn(
        'Geolocation support is not available, the GeolocateControl will not be visible.'
      );
      /* eslint-enable no-console, no-undef */
      return;
    }

    const controlOptions = {};
    ['positionOptions', 'fitBoundsOptions', 'trackUserLocation', 'showUserLocation'].forEach(
      prop => {
        // For null option, use Mapbox default value
        if (prop in this.props && this.props[prop] !== null) {
          controlOptions[prop] = this.props[prop];
        }
      }
    );

    this._mapboxGeolocateControl = new mapboxgl.GeolocateControl(controlOptions);

    // the following re-implement MapboxGeolocateControl's _setupUI
    // replace mapbox internal prop
    this._mapboxGeolocateControl._watchState = 'OFF';

    // replace mapbox internal UI elements
    this._mapboxGeolocateControl._geolocateButton = this._geolocateButtonRef.current;

    // replace mapbox internal methods
    this._mapboxGeolocateControl._updateMarker = this._updateMarker;
    this._mapboxGeolocateControl._updateCamera = this._updateCamera;

    this._mapboxGeolocateControl._setup = true;
  };

  _onClickGeolocate = () => {
    return this._mapboxGeolocateControl.trigger();
  };

  _updateMarker = (position: Position) => {
    if (position) {
      this.setState({markerPosition: position.coords});
    }
  };

  _getBounds = (position: Position) => {
    const center = new mapboxgl.LngLat(position.coords.longitude, position.coords.latitude);
    const radius = position.coords.accuracy;
    const bounds = center.toBounds(radius);

    return [[bounds._ne.lng, bounds._ne.lat], [bounds._sw.lng, bounds._sw.lat]];
  };

  _updateCamera = (position: Position) => {
    const {viewport} = this._context;

    const bounds = this._getBounds(position);
    const {longitude, latitude, zoom} = new WebMercatorViewport(viewport).fitBounds(bounds);

    const newViewState = Object.assign({}, viewport, {
      longitude,
      latitude,
      zoom
    });
    const mapState = new MapState(newViewState);
    const viewState = Object.assign({}, mapState.getViewportProps(), LINEAR_TRANSITION_PROPS);

    const onViewportChange = this.props.onViewportChange || this._context.onViewportChange || noop;
    const onViewStateChange =
      this.props.onViewStateChange || this._context.onViewStateChange || noop;

    // Call new style callback
    onViewStateChange({viewState});

    // Call old style callback
    onViewportChange(viewState);
  };

  _renderButton = (type: string, label: string, callback: Function) => {
    return (
      <button
        key={type}
        className={`mapboxgl-ctrl-icon mapboxgl-ctrl-${type}`}
        ref={this._geolocateButtonRef}
        type="button"
        title={label}
        onClick={callback}
      />
    );
  };

  _renderMarker = () => {
    const {showUserLocation} = this.props;
    const {markerPosition} = this.state;
    if (!showUserLocation || !markerPosition) {
      return null;
    }

    return (
      // $FlowFixMe
      <Marker
        key="location-maker"
        ref={this._markerRef}
        className="mapboxgl-user-location-dot"
        longitude={markerPosition.longitude}
        latitude={markerPosition.latitude}
        onContextMenu={e => e.preventDefault()}
        captureDrag={false}
        captureDoubleClick={false}
      />
    );
  };

  _render() {
    if (!this.state.supportsGeolocation) {
      return null;
    }

    const {className, style} = this.props;
    return (
      <div>
        {this._renderMarker()}
        <div
          key="geolocate-control"
          className={`mapboxgl-ctrl mapboxgl-ctrl-group ${className}`}
          ref={this._containerRef}
          style={style}
          onContextMenu={e => e.preventDefault()}
        >
          {this._renderButton('geolocate', 'Geolocate', this._onClickGeolocate)}
        </div>
      </div>
    );
  }
}

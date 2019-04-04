import {clamp} from 'math.gl';
import Controller from './controller';
import ViewState from './view-state';
import WebMercatorViewport, {normalizeViewportProps} from 'viewport-mercator-project';
import assert from '../utils/assert';
import LinearInterpolator from '../transitions/linear-interpolator';
import {TRANSITION_EVENTS} from './transition-manager';

const LINEAR_TRANSITION_PROPS = {
  transitionDuration: 300,
  transitionEasing: t => t,
  transitionInterpolator: new LinearInterpolator(),
  transitionInterruption: TRANSITION_EVENTS.BREAK
};

// MAPBOX LIMITS
export const MAPBOX_LIMITS = {
  minZoom: 0,
  maxZoom: 20,
  minPitch: 0,
  maxPitch: 60
};

const DEFAULT_STATE = {
  pitch: 0,
  bearing: 0,
  altitude: 1.5
};

/* Utils */

class MapState extends ViewState {
  constructor({
    /** Mapbox viewport properties */
    /** The width of the viewport */
    width,
    /** The height of the viewport */
    height,
    /** The latitude at the center of the viewport */
    latitude,
    /** The longitude at the center of the viewport */
    longitude,
    /** The tile zoom level of the map. */
    zoom,
    /** The bearing of the viewport in degrees */
    bearing = DEFAULT_STATE.bearing,
    /** The pitch of the viewport in degrees */
    pitch = DEFAULT_STATE.pitch,
    /**
     * Specify the altitude of the viewport camera
     * Unit: map heights, default 1.5
     * Non-public API, see https://github.com/mapbox/mapbox-gl-js/issues/1137
     */
    altitude = DEFAULT_STATE.altitude,

    /** Viewport constraints */
    maxZoom = MAPBOX_LIMITS.maxZoom,
    minZoom = MAPBOX_LIMITS.minZoom,
    maxPitch = MAPBOX_LIMITS.maxPitch,
    minPitch = MAPBOX_LIMITS.minPitch,

    /** Interaction states, required to calculate change during transform */
    /* The point on map being grabbed when the operation first started */
    startPanLngLat,
    /* Center of the zoom when the operation first started */
    startZoomLngLat,
    /** Bearing when current perspective rotate operation started */
    startBearing,
    /** Pitch when current perspective rotate operation started */
    startPitch,
    /** Zoom when current zoom operation started */
    startZoom
  } = {}) {
    assert(Number.isFinite(longitude), '`longitude` must be supplied');
    assert(Number.isFinite(latitude), '`latitude` must be supplied');
    assert(Number.isFinite(zoom), '`zoom` must be supplied');

    super({
      width,
      height,
      latitude,
      longitude,
      zoom,
      bearing,
      pitch,
      altitude,
      maxZoom,
      minZoom,
      maxPitch,
      minPitch
    });

    this._interactiveState = {
      startPanLngLat,
      startZoomLngLat,
      startBearing,
      startPitch,
      startZoom
    };
  }

  /* Public API */

  getViewportProps() {
    return this._viewportProps;
  }

  getInteractiveState() {
    return this._interactiveState;
  }

  /**
   * Start panning
   * @param {[Number, Number]} pos - position on screen where the pointer grabs
   */
  panStart({pos}) {
    return this._getUpdatedState({
      startPanLngLat: this._unproject(pos)
    });
  }

  /**
   * Pan
   * @param {[Number, Number]} pos - position on screen where the pointer is
   * @param {[Number, Number], optional} startPos - where the pointer grabbed at
   *   the start of the operation. Must be supplied of `panStart()` was not called
   */
  pan({pos, startPos}) {
    const startPanLngLat = this._interactiveState.startPanLngLat || this._unproject(startPos);

    if (!startPanLngLat) {
      return this;
    }

    const [longitude, latitude] = this._calculateNewLngLat({startPanLngLat, pos});

    return this._getUpdatedState({
      longitude,
      latitude
    });
  }

  /**
   * End panning
   * Must call if `panStart()` was called
   */
  panEnd() {
    return this._getUpdatedState({
      startPanLngLat: null
    });
  }

  /**
   * Start rotating
   * @param {[Number, Number]} pos - position on screen where the center is
   */
  rotateStart({pos}) {
    return this._getUpdatedState({
      startBearing: this._viewportProps.bearing,
      startPitch: this._viewportProps.pitch
    });
  }

  /**
   * Rotate
   * @param {Number} deltaScaleX - a number between [-1, 1] specifying the
   *   change to bearing.
   * @param {Number} deltaScaleY - a number between [-1, 1] specifying the
   *   change to pitch. -1 sets to minPitch and 1 sets to maxPitch.
   */
  rotate({deltaScaleX = 0, deltaScaleY = 0}) {
    const {startBearing, startPitch} = this._interactiveState;

    if (!Number.isFinite(startBearing) || !Number.isFinite(startPitch)) {
      return this;
    }

    const {pitch, bearing} = this._calculateNewPitchAndBearing({
      deltaScaleX,
      deltaScaleY,
      startBearing,
      startPitch
    });

    return this._getUpdatedState({
      bearing,
      pitch
    });
  }

  /**
   * End rotating
   * Must call if `rotateStart()` was called
   */
  rotateEnd() {
    return this._getUpdatedState({
      startBearing: null,
      startPitch: null
    });
  }

  /**
   * Start zooming
   * @param {[Number, Number]} pos - position on screen where the center is
   */
  zoomStart({pos}) {
    return this._getUpdatedState({
      startZoomLngLat: this._unproject(pos),
      startZoom: this._viewportProps.zoom
    });
  }

  /**
   * Zoom
   * @param {[Number, Number]} pos - position on screen where the current center is
   * @param {[Number, Number]} startPos - the center position at
   *   the start of the operation. Must be supplied of `zoomStart()` was not called
   * @param {Number} scale - a number between [0, 1] specifying the accumulated
   *   relative scale.
   */
  zoom({pos, startPos, scale}) {
    assert(scale > 0, '`scale` must be a positive number');

    // Make sure we zoom around the current mouse position rather than map center
    let {startZoom, startZoomLngLat} = this._interactiveState;

    if (!Number.isFinite(startZoom)) {
      // We have two modes of zoom:
      // scroll zoom that are discrete events (transform from the current zoom level),
      // and pinch zoom that are continuous events (transform from the zoom level when
      // pinch started).
      // If startZoom state is defined, then use the startZoom state;
      // otherwise assume discrete zooming
      startZoom = this._viewportProps.zoom;
      startZoomLngLat = this._unproject(startPos) || this._unproject(pos);
    }

    // take the start lnglat and put it where the mouse is down.
    assert(
      startZoomLngLat,
      '`startZoomLngLat` prop is required ' +
        'for zoom behavior to calculate where to position the map.'
    );

    const zoom = this._calculateNewZoom({scale, startZoom});

    const zoomedViewport = new WebMercatorViewport(Object.assign({}, this._viewportProps, {zoom}));
    const [longitude, latitude] = zoomedViewport.getLocationAtPoint({lngLat: startZoomLngLat, pos});

    return this._getUpdatedState({
      zoom,
      longitude,
      latitude
    });
  }

  /**
   * End zooming
   * Must call if `zoomStart()` was called
   */
  zoomEnd() {
    return this._getUpdatedState({
      startZoomLngLat: null,
      startZoom: null
    });
  }

  zoomIn() {
    return this._zoomFromCenter(2);
  }

  zoomOut() {
    return this._zoomFromCenter(0.5);
  }

  moveLeft() {
    return this._panFromCenter([100, 0]);
  }

  moveRight() {
    return this._panFromCenter([-100, 0]);
  }

  moveUp() {
    return this._panFromCenter([0, 100]);
  }

  moveDown() {
    return this._panFromCenter([0, -100]);
  }

  rotateLeft() {
    return this._getUpdatedState({
      bearing: this._viewportProps.bearing - 15
    });
  }

  rotateRight() {
    return this._getUpdatedState({
      bearing: this._viewportProps.bearing + 15
    });
  }

  rotateUp() {
    return this._getUpdatedState({
      pitch: this._viewportProps.pitch + 10
    });
  }

  rotateDown() {
    return this._getUpdatedState({
      pitch: this._viewportProps.pitch - 10
    });
  }

  shortestPathFrom(viewState) {
    // const endViewStateProps = new this.ControllerState(endProps).shortestPathFrom(startViewstate);
    const fromProps = viewState.getViewportProps();
    const props = Object.assign({}, this._viewportProps);
    const {bearing, longitude} = props;

    if (Math.abs(bearing - fromProps.bearing) > 180) {
      props.bearing = bearing < 0 ? bearing + 360 : bearing - 360;
    }
    if (Math.abs(longitude - fromProps.longitude) > 180) {
      props.longitude = longitude < 0 ? longitude + 360 : longitude - 360;
    }
    return props;
  }

  /* Private methods */

  _zoomFromCenter(scale) {
    const {width, height} = this._viewportProps;
    return this.zoom({
      pos: [width / 2, height / 2],
      scale
    });
  }

  _panFromCenter(offset) {
    const {width, height} = this._viewportProps;
    return this.pan({
      startPos: [width / 2, height / 2],
      pos: [width / 2 + offset[0], height / 2 + offset[1]]
    });
  }

  _getUpdatedState(newProps) {
    // Update _viewportProps
    return new MapState(Object.assign({}, this._viewportProps, this._interactiveState, newProps));
  }

  // Apply any constraints (mathematical or defined by _viewportProps) to map state
  _applyConstraints(props) {
    // Ensure zoom is within specified range
    const {maxZoom, minZoom, zoom} = props;
    props.zoom = clamp(zoom, minZoom, maxZoom);

    // Ensure pitch is within specified range
    const {maxPitch, minPitch, pitch} = props;
    props.pitch = clamp(pitch, minPitch, maxPitch);

    Object.assign(props, normalizeViewportProps(props));

    return props;
  }

  _unproject(pos) {
    const viewport = new WebMercatorViewport(this._viewportProps);
    return pos && viewport.unproject(pos);
  }

  // Calculate a new lnglat based on pixel dragging position
  _calculateNewLngLat({startPanLngLat, pos}) {
    const viewport = new WebMercatorViewport(this._viewportProps);
    return viewport.getMapCenterByLngLatPosition({lngLat: startPanLngLat, pos});
  }

  // Calculates new zoom
  _calculateNewZoom({scale, startZoom}) {
    const {maxZoom, minZoom} = this._viewportProps;
    const zoom = startZoom + Math.log2(scale);
    return clamp(zoom, minZoom, maxZoom);
  }

  // Calculates a new pitch and bearing from a position (coming from an event)
  _calculateNewPitchAndBearing({deltaScaleX, deltaScaleY, startBearing, startPitch}) {
    // clamp deltaScaleY to [-1, 1] so that rotation is constrained between minPitch and maxPitch.
    // deltaScaleX does not need to be clamped as bearing does not have constraints.
    deltaScaleY = clamp(deltaScaleY, -1, 1);

    const {minPitch, maxPitch} = this._viewportProps;

    const bearing = startBearing + 180 * deltaScaleX;
    let pitch = startPitch;
    if (deltaScaleY > 0) {
      // Gradually increase pitch
      pitch = startPitch + deltaScaleY * (maxPitch - startPitch);
    } else if (deltaScaleY < 0) {
      // Gradually decrease pitch
      pitch = startPitch - deltaScaleY * (minPitch - startPitch);
    }

    return {
      pitch,
      bearing
    };
  }
}

export default class MapController extends Controller {
  constructor(props) {
    super(MapState, props);
    this.invertPan = true;
  }

  _getTransitionProps() {
    // Transitions on double-tap and key-down are only supported by MapController
    return LINEAR_TRANSITION_PROPS;
  }
}

export const testExports = {MapState};

import Controller from './controller';
import ViewState from './view-state';

import {Vector3, clamp} from 'math.gl';

const MOVEMENT_SPEED = 1; // 1 meter per keyboard click
const ROTATION_STEP_DEGREES = 2;

/* Helpers */

function ensureFinite(value, fallbackValue) {
  return Number.isFinite(value) ? value : fallbackValue;
}

class FirstPersonState extends ViewState {
  constructor({
    /* Viewport arguments */
    width, // Width of viewport
    height, // Height of viewport

    // Position and orientation
    position, // typically in meters from anchor point

    bearing, // Rotation around y axis
    pitch, // Rotation around x axis

    // Geospatial anchor
    longitude,
    latitude,
    zoom,

    syncBearing = true, // Whether to lock bearing to direction

    // Constraints - simple movement limit
    // Bounding box of the world, in the shape of {minX, maxX, minY, maxY, minZ, maxZ}
    bounds,

    /** Interaction states, required to calculate change during transform */
    // Model state when the pan operation first started
    startPanEventPosition,
    startPanPosition,

    // Model state when the rotate operation first started
    startRotateCenter,
    startRotateViewport,

    // Model state when the zoom operation first started
    startZoomPos,
    startZoom
  }) {
    super({
      width,
      height,
      position,
      bearing,
      pitch,
      longitude,
      latitude,
      zoom
    });

    this._interactiveState = {
      startPanEventPosition,
      startPanPosition,
      startRotateCenter,
      startRotateViewport,
      startZoomPos,
      startZoom
    };
  }

  /* Public API */

  getInteractiveState() {
    return this._interactiveState;
  }

  /**
   * Start panning
   * @param {[Number, Number]} pos - position on screen where the pointer grabs
   */
  panStart({pos}) {
    const {translationX, translationY} = this._viewportProps;

    return this._getUpdatedState({
      startPanPosition: [translationX, translationY],
      startPanEventPosition: pos
    });
  }

  /**
   * Pan
   * @param {[Number, Number]} pos - position on screen where the pointer is
   */
  pan({pos, startPos}) {
    const startPanEventPosition = this._interactiveState.startPanEventPosition || startPos;

    // when the mouse starts dragging outside of this viewport, then drags over it.
    // TODO - use interactionState flag instead
    if (!startPanEventPosition) {
      return this;
    }

    let [translationX, translationY] = this._interactiveState.startPanPosition || [];
    translationX = ensureFinite(translationX, this._viewportProps.translationX);
    translationY = ensureFinite(translationY, this._viewportProps.translationY);

    const deltaX = pos[0] - startPanEventPosition[0];
    const deltaY = pos[1] - startPanEventPosition[1];

    return this._getUpdatedState({
      translationX: translationX + deltaX,
      translationY: translationY - deltaY
    });
  }

  /**
   * End panning
   * Must call if `panStart()` was called
   */
  panEnd() {
    return this._getUpdatedState({
      startPanPosition: null,
      startPanPos: null
    });
  }

  /**
   * Start rotating
   * @param {[Number, Number]} pos - position on screen where the pointer grabs
   */
  rotateStart({pos}) {
    return this._getUpdatedState({
      startRotateCenter: this._viewportProps.position,
      startRotateViewport: this._viewportProps
    });
  }

  /**
   * Rotate
   * @param {[Number, Number]} pos - position on screen where the pointer is
   */
  rotate({deltaScaleX, deltaScaleY}) {
    // when the mouse starts dragging outside of this viewport, then drags over it.
    // TODO - use interactionState flag instead
    if (!this._interactiveState.startRotateCenter) {
      return this;
    }

    const {bearing, pitch} = this._viewportProps;

    return this._getUpdatedState({
      bearing: bearing + deltaScaleX * 10,
      pitch: pitch - deltaScaleY * 10
    });
  }

  /**
   * End rotating
   * Must call if `rotateStart()` was called
   */
  rotateEnd() {
    return this._getUpdatedState({
      startRotateCenter: null,
      startRotateViewport: null
    });
  }

  /**
   * Start zooming
   * @param {[Number, Number]} pos - position on screen where the pointer grabs
   */
  zoomStart({pos}) {
    return this._getUpdatedState({
      startZoomPos: pos,
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
    const {zoom, minZoom, maxZoom, width, height, translationX, translationY} = this._viewportProps;

    const startZoomPos = this._interactiveState.startZoomPos || startPos || pos;

    const newZoom = clamp(zoom * scale, minZoom, maxZoom);
    const deltaX = pos[0] - startZoomPos[0];
    const deltaY = pos[1] - startZoomPos[1];

    // Zoom around the center position
    const cx = startZoomPos[0] - width / 2;
    const cy = height / 2 - startZoomPos[1];
    /* eslint-disable no-unused-vars */
    const newTranslationX = cx - ((cx - translationX) * newZoom) / zoom + deltaX;
    const newTranslationY = cy - ((cy - translationY) * newZoom) / zoom - deltaY;
    /* eslint-enable no-unused-vars */

    // return this._getUpdatedState({
    //   position
    //   translationX: newTranslationX,
    //   translationY: newTranslationY
    // });

    // TODO HACK
    return newZoom / zoom < 1 ? this.moveBackward() : this.moveForward();
  }

  /**
   * End zooming
   * Must call if `zoomStart()` was called
   */
  zoomEnd() {
    return this._getUpdatedState({
      startZoomPos: null,
      startZoom: null
    });
  }

  moveLeft() {
    const {bearing} = this._viewportProps;
    const newBearing = bearing - ROTATION_STEP_DEGREES;
    return this._getUpdatedState({
      bearing: newBearing
    });
  }

  moveRight() {
    const {bearing} = this._viewportProps;
    const newBearing = bearing + ROTATION_STEP_DEGREES;
    return this._getUpdatedState({
      bearing: newBearing
    });
  }

  moveForward() {
    const {position} = this._viewportProps;
    const direction = this.getDirection();
    const delta = new Vector3(direction).normalize().scale(MOVEMENT_SPEED);
    return this._getUpdatedState({
      position: new Vector3(position).add(delta)
    });
  }

  moveBackward() {
    const {position} = this._viewportProps;
    const direction = this.getDirection();
    const delta = new Vector3(direction).normalize().scale(-MOVEMENT_SPEED);
    return this._getUpdatedState({
      position: new Vector3(position).add(delta)
    });
  }

  moveUp() {
    const {position} = this._viewportProps;
    const delta = [0, 0, 1];
    return this._getUpdatedState({
      position: new Vector3(position).add(delta)
    });
  }

  moveDown() {
    const {position} = this._viewportProps;
    const delta = position[2] >= 1 ? [0, 0, -1] : [0, 0, 0];
    return this._getUpdatedState({
      position: new Vector3(position).add(delta)
    });
  }

  zoomIn() {
    return this._getUpdatedState({
      zoom: this._viewportProps.zoom + 0.2
    });
  }

  zoomOut() {
    return this._getUpdatedState({
      zoom: this._viewportProps.zoom - 0.2
    });
  }

  /* Private methods */

  _getUpdatedState(newProps) {
    // Update _viewportProps
    return new FirstPersonState(
      Object.assign({}, this._viewportProps, this._interactiveState, newProps)
    );
  }
}

export default class FirstPersonController extends Controller {
  constructor(props) {
    super(FirstPersonState, props);
  }
}

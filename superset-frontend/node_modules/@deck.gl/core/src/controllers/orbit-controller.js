import {clamp, Vector2} from 'math.gl';
import Controller from './controller';
import ViewState from './view-state';
import LinearInterpolator from '../transitions/linear-interpolator';
import {TRANSITION_EVENTS} from './transition-manager';

const MOVEMENT_SPEED = 50; // per keyboard click

const DEFAULT_STATE = {
  orbitAxis: 'Z',
  rotationX: 0,
  rotationOrbit: 0,
  fovy: 50,
  zoom: 0,
  target: [0, 0, 0],
  minZoom: -Infinity,
  maxZoom: Infinity
};

const LINEAR_TRANSITION_PROPS = {
  transitionDuration: 300,
  transitionEasing: t => t,
  transitionInterpolator: new LinearInterpolator(['target', 'zoom', 'rotationX', 'rotationOrbit']),
  transitionInterruption: TRANSITION_EVENTS.BREAK
};

/* Helpers */

const zoom2Scale = zoom => Math.pow(2, zoom);

export class OrbitState extends ViewState {
  constructor({
    ViewportType,

    /* Viewport arguments */
    width, // Width of viewport
    height, // Height of viewport
    orbitAxis = DEFAULT_STATE.orbitAxis,
    rotationX = DEFAULT_STATE.rotationX, // Rotation around x axis
    rotationOrbit = DEFAULT_STATE.rotationOrbit, // Rotation around orbit axis
    target = DEFAULT_STATE.target,
    zoom = DEFAULT_STATE.zoom,
    fovy = DEFAULT_STATE.fovy,

    /* Viewport constraints */
    minZoom = DEFAULT_STATE.minZoom,
    maxZoom = DEFAULT_STATE.maxZoom,

    /** Interaction states, required to calculate change during transform */
    // Model state when the pan operation first started
    startPanPosition,
    startTarget,
    // Model state when the rotate operation first started
    startRotationX,
    startRotationOrbit,
    // Model state when the zoom operation first started
    startZoomPosition,
    startZoom
  }) {
    super({
      width,
      height,
      orbitAxis,
      rotationX,
      rotationOrbit,
      target,
      fovy,
      zoom,
      minZoom,
      maxZoom
    });

    this._interactiveState = {
      startPanPosition,
      startTarget,
      startRotationX,
      startRotationOrbit,
      startZoomPosition,
      startZoom
    };

    this.ViewportType = ViewportType;
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
    const {target} = this._viewportProps;

    return this._getUpdatedState({
      startPanPosition: pos,
      startTarget: target
    });
  }

  /**
   * Pan
   * @param {[Number, Number]} pos - position on screen where the pointer is
   */
  pan({pos, startPos}) {
    const {startPanPosition, startTarget} = this._interactiveState;
    const delta = new Vector2(pos).subtract(startPanPosition);

    return this._getUpdatedState({
      target: this._calculateNewTarget({startTarget, pixelOffset: delta})
    });
  }

  /**
   * End panning
   * Must call if `panStart()` was called
   */
  panEnd() {
    return this._getUpdatedState({
      startPanPosition: null,
      startTarget: null
    });
  }

  /**
   * Start rotating
   * @param {[Number, Number]} pos - position on screen where the pointer grabs
   */
  rotateStart({pos}) {
    return this._getUpdatedState({
      startRotationX: this._viewportProps.rotationX,
      startRotationOrbit: this._viewportProps.rotationOrbit
    });
  }

  /**
   * Rotate
   * @param {[Number, Number]} pos - position on screen where the pointer is
   */
  rotate({deltaScaleX, deltaScaleY}) {
    const {startRotationX, startRotationOrbit} = this._interactiveState;

    if (!Number.isFinite(startRotationX) || !Number.isFinite(startRotationOrbit)) {
      return this;
    }

    const newRotationX = clamp(startRotationX + deltaScaleY * 180, -89.999, 89.999);
    const newRotationOrbit = (startRotationOrbit + deltaScaleX * 180) % 360;

    return this._getUpdatedState({
      rotationX: newRotationX,
      rotationOrbit: newRotationOrbit,
      isRotating: true
    });
  }

  /**
   * End rotating
   * Must call if `rotateStart()` was called
   */
  rotateEnd() {
    return this._getUpdatedState({
      startRotationX: null,
      startRotationOrbit: null
    });
  }

  // default implementation of shortest path between two view states
  shortestPathFrom(viewState) {
    const props = Object.assign({}, this._viewportProps);
    return props;
  }

  /**
   * Start zooming
   * @param {[Number, Number]} pos - position on screen where the pointer grabs
   */
  zoomStart({pos}) {
    return this._getUpdatedState({
      startZoomPosition: pos,
      startTarget: this._viewportProps.target,
      startZoom: this._viewportProps.zoom
    });
  }

  /**
   * Zoom
   * @param {[Number, Number]} pos - position on screen where the current target is
   * @param {[Number, Number]} startPos - the target position at
   *   the start of the operation. Must be supplied of `zoomStart()` was not called
   * @param {Number} scale - a number between [0, 1] specifying the accumulated
   *   relative scale.
   */
  zoom({pos, startPos, scale}) {
    const {zoom, width, height, target} = this._viewportProps;
    let {startZoom, startZoomPosition, startTarget} = this._interactiveState;
    if (!Number.isFinite(startZoom)) {
      // We have two modes of zoom:
      // scroll zoom that are discrete events (transform from the current zoom level),
      // and pinch zoom that are continuous events (transform from the zoom level when
      // pinch started).
      // If startZoom state is defined, then use the startZoom state;
      // otherwise assume discrete zooming
      startZoom = zoom;
      startTarget = target;
      startZoomPosition = startPos || pos;
    }

    const newZoom = this._calculateNewZoom({scale, startZoom});
    const startScale = zoom2Scale(startZoom);
    const newScale = zoom2Scale(newZoom);

    const dX = (width / 2 - startZoomPosition[0]) * (newScale / startScale - 1);
    const dY = (height / 2 - startZoomPosition[1]) * (newScale / startScale - 1);

    return this._getUpdatedState({
      zoom: newZoom,
      target: this._calculateNewTarget({startTarget, zoom: newZoom, pixelOffset: [dX, dY]})
    });
  }

  /**
   * End zooming
   * Must call if `zoomStart()` was called
   */
  zoomEnd() {
    return this._getUpdatedState({
      startZoomPosition: null,
      startTarget: null,
      startZoom: null
    });
  }

  zoomIn() {
    return this._getUpdatedState({
      zoom: this._calculateNewZoom({scale: 2})
    });
  }

  zoomOut() {
    return this._getUpdatedState({
      zoom: this._calculateNewZoom({scale: 0.5})
    });
  }

  moveLeft() {
    const pixelOffset = [-MOVEMENT_SPEED, 0];
    return this._getUpdatedState({
      target: this._calculateNewTarget({pixelOffset})
    });
  }

  moveRight() {
    const pixelOffset = [MOVEMENT_SPEED, 0];
    return this._getUpdatedState({
      target: this._calculateNewTarget({pixelOffset})
    });
  }

  moveUp() {
    const pixelOffset = [0, -MOVEMENT_SPEED];
    return this._getUpdatedState({
      target: this._calculateNewTarget({pixelOffset})
    });
  }

  moveDown() {
    const pixelOffset = [0, MOVEMENT_SPEED];
    return this._getUpdatedState({
      target: this._calculateNewTarget({pixelOffset})
    });
  }

  rotateLeft() {
    return this._getUpdatedState({
      rotationOrbit: this._viewportProps.rotationOrbit - 15
    });
  }

  rotateRight() {
    return this._getUpdatedState({
      rotationOrbit: this._viewportProps.rotationOrbit + 15
    });
  }

  rotateUp() {
    return this._getUpdatedState({
      rotationX: this._viewportProps.rotationX - 10
    });
  }

  rotateDown() {
    return this._getUpdatedState({
      rotationX: this._viewportProps.rotationX + 10
    });
  }

  /* Private methods */

  // Calculates new zoom
  _calculateNewZoom({scale, startZoom}) {
    const {maxZoom, minZoom} = this._viewportProps;
    if (!Number.isFinite(startZoom)) {
      startZoom = this._viewportProps.zoom;
    }
    const zoom = startZoom + Math.log2(scale);
    return clamp(zoom, minZoom, maxZoom);
  }

  _calculateNewTarget({startTarget, zoom, pixelOffset}) {
    const viewportProps = Object.assign({}, this._viewportProps);
    if (Number.isFinite(zoom)) {
      viewportProps.zoom = zoom;
    }
    if (startTarget) {
      viewportProps.target = startTarget;
    }
    const viewport = new this.ViewportType(viewportProps);
    const center = viewport.project(viewportProps.target);
    return viewport.unproject([center[0] - pixelOffset[0], center[1] - pixelOffset[1], center[2]]);
  }

  _getUpdatedState(newProps) {
    // Update _viewportProps
    return new OrbitState(Object.assign({}, this._viewportProps, this._interactiveState, newProps));
  }

  // Apply any constraints (mathematical or defined by _viewportProps) to map state
  _applyConstraints(props) {
    // Ensure zoom is within specified range
    const {maxZoom, minZoom, zoom} = props;
    props.zoom = zoom > maxZoom ? maxZoom : zoom;
    props.zoom = zoom < minZoom ? minZoom : zoom;

    return props;
  }
}

export default class OrbitController extends Controller {
  constructor(props) {
    super(OrbitState, props);
  }

  _getTransitionProps() {
    // Enables Transitions on double-tap and key-down events.
    return LINEAR_TRANSITION_PROPS;
  }
}

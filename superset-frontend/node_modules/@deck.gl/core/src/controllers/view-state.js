import {Vector3, _SphericalCoordinates as SphericalCoordinates} from 'math.gl';
import assert from '../utils/assert';

const defaultState = {
  position: [0, 0, 0],
  lookAt: [0, 0, 0],
  up: [0, 0, 1],

  rotationX: 0,
  rotationY: 0,

  fov: 50,
  near: 1,
  far: 100
};

/* Helpers */

export default class ViewState {
  constructor(opts) {
    const {
      width, // Width of viewport
      height, // Height of viewport

      // Position and orientation
      position = defaultState.position // typically in meters from anchor point
    } = opts;

    assert(Number.isFinite(width), '`width` must be supplied');
    assert(Number.isFinite(height), '`height` must be supplied');

    this._viewportProps = this._applyConstraints(
      Object.assign({}, opts, {
        position: new Vector3(position)
      })
    );
  }

  getViewportProps() {
    return this._viewportProps;
  }

  getDirection() {
    const spherical = new SphericalCoordinates({
      bearing: this._viewportProps.bearing,
      pitch: this._viewportProps.pitch
    });
    const direction = spherical.toVector3().normalize();
    return direction;
  }

  getDirectionFromBearing(bearing) {
    const spherical = new SphericalCoordinates({
      bearing,
      pitch: 90
    });
    const direction = spherical.toVector3().normalize();
    return direction;
  }

  shortestPathFrom(viewState) {
    return this._viewportProps;
  }

  // Redefined by subclass
  // Apply any constraints (mathematical or defined by _viewportProps) to map state
  _applyConstraints(props) {
    return props;
  }
}

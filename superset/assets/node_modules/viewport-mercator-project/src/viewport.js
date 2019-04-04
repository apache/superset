// View and Projection Matrix management

import {createMat4} from './math-utils';
import {worldToPixels, pixelsToWorld} from './web-mercator-utils';

import * as mat4 from 'gl-matrix/mat4';

const IDENTITY = createMat4();

export default class Viewport {
  /**
   * @classdesc
   * Manages coordinate system transformations for deck.gl.
   *
   * Note: The Viewport is immutable in the sense that it only has accessors.
   * A new viewport instance should be created if any parameters have changed.
   *
   * @class
   * @param {Object} opt - options
   * @param {Boolean} mercator=true - Whether to use mercator projection
   *
   * @param {Number} opt.width=1 - Width of "viewport" or window
   * @param {Number} opt.height=1 - Height of "viewport" or window
   * @param {Array} opt.center=[0, 0] - Center of viewport
   *   [longitude, latitude] or [x, y]
   * @param {Number} opt.scale=1 - Either use scale or zoom
   * @param {Number} opt.pitch=0 - Camera angle in degrees (0 is straight down)
   * @param {Number} opt.bearing=0 - Map rotation in degrees (0 means north is up)
   * @param {Number} opt.altitude= - Altitude of camera in screen units
   *
   * Web mercator projection short-hand parameters
   * @param {Number} opt.latitude - Center of viewport on map (alternative to opt.center)
   * @param {Number} opt.longitude - Center of viewport on map (alternative to opt.center)
   * @param {Number} opt.zoom - Scale = Math.pow(2,zoom) on map (alternative to opt.scale)
   */
  /* eslint-disable complexity */
  constructor({
    // Window width/height in pixels (for pixel projection)
    width,
    height,
    // Desc
    viewMatrix = IDENTITY,
    projectionMatrix = IDENTITY
  } = {}) {
    // Silently allow apps to send in 0,0
    this.width = width || 1;
    this.height = height || 1;
    this.scale = 1;
    this.pixelsPerMeter = 1;

    this.viewMatrix = viewMatrix;
    this.projectionMatrix = projectionMatrix;

    // Note: As usual, matrix operations should be applied in "reverse" order
    // since vectors will be multiplied in from the right during transformation
    const vpm = createMat4();
    mat4.multiply(vpm, vpm, this.projectionMatrix);
    mat4.multiply(vpm, vpm, this.viewMatrix);
    this.viewProjectionMatrix = vpm;

    // Calculate matrices and scales needed for projection
    /**
     * Builds matrices that converts preprojected lngLats to screen pixels
     * and vice versa.
     * Note: Currently returns bottom-left coordinates!
     * Note: Starts with the GL projection matrix and adds steps to the
     *       scale and translate that matrix onto the window.
     * Note: WebGL controls clip space to screen projection with gl.viewport
     *       and does not need this step.
     */
    const m = createMat4();

    // matrix for conversion from location to screen coordinates
    mat4.scale(m, m, [this.width / 2, -this.height / 2, 1]);
    mat4.translate(m, m, [1, -1, 0]);

    mat4.multiply(m, m, this.viewProjectionMatrix);

    const mInverse = mat4.invert(createMat4(), m);
    if (!mInverse) {
      throw new Error('Pixel project matrix not invertible');
    }

    this.pixelProjectionMatrix = m;
    this.pixelUnprojectionMatrix = mInverse;

    // Bind methods for easy access
    this.equals = this.equals.bind(this);
    this.project = this.project.bind(this);
    this.unproject = this.unproject.bind(this);
    this.projectPosition = this.projectPosition.bind(this);
    this.unprojectPosition = this.unprojectPosition.bind(this);
    this.projectFlat = this.projectFlat.bind(this);
    this.unprojectFlat = this.unprojectFlat.bind(this);
  }
  /* eslint-enable complexity */

  // Two viewports are equal if width and height are identical, and if
  // their view and projection matrices are (approximately) equal.
  equals(viewport) {
    if (!(viewport instanceof Viewport)) {
      return false;
    }

    return viewport.width === this.width &&
      viewport.height === this.height &&
      mat4.equals(viewport.projectionMatrix, this.projectionMatrix) &&
      mat4.equals(viewport.viewMatrix, this.viewMatrix);
  }

  /**
   * Projects xyz (possibly latitude and longitude) to pixel coordinates in window
   * using viewport projection parameters
   * - [longitude, latitude] to [x, y]
   * - [longitude, latitude, Z] => [x, y, z]
   * Note: By default, returns top-left coordinates for canvas/SVG type render
   *
   * @param {Array} lngLatZ - [lng, lat] or [lng, lat, Z]
   * @param {Object} opts - options
   * @param {Object} opts.topLeft=true - Whether projected coords are top left
   * @return {Array} - screen coordinates [x, y] or [x, y, z], z as pixel depth
   */
  project(xyz, {topLeft = true} = {}) {
    const worldPosition = this.projectPosition(xyz);
    const coord = worldToPixels(worldPosition, this.pixelProjectionMatrix);

    const [x, y] = coord;
    const y2 = topLeft ? y : this.height - y;
    return xyz.length === 2 ? [x, y2] : [x, y2, coord[2]];
  }

  /**
   * Unproject pixel coordinates on screen onto world coordinates,
   * (possibly [lon, lat]) on map.
   * - [x, y] => [lng, lat]
   * - [x, y, z] => [lng, lat, Z]
   * @param {Array} xyz - screen coordinates, z as pixel depth
   * @param {Object} opts - options
   * @param {Object} opts.topLeft=true - Whether projected coords are top left
   * @param {Object} opts.targetZ=0 - If pixel depth is unknown, targetZ is used as
   *   the elevation plane to unproject onto
   * @return {Array} - [lng, lat, Z] or [X, Y, Z]
   */
  unproject(xyz, {topLeft = true, targetZ} = {}) {
    const [x, y, z] = xyz;

    const y2 = topLeft ? y : this.height - y;
    const targetZWorld = targetZ && targetZ * this.pixelsPerMeter;
    const coord = pixelsToWorld([x, y2, z], this.pixelUnprojectionMatrix, targetZWorld);
    const [X, Y, Z] = this.unprojectPosition(coord);

    if (Number.isFinite(z)) {
      return [X, Y, Z];
    }
    return Number.isFinite(targetZ) ? [X, Y, targetZ] : [X, Y];
  }

  // NON_LINEAR PROJECTION HOOKS
  // Used for web meractor projection

  projectPosition(xyz) {
    const [X, Y] = this.projectFlat(xyz);
    const Z = (xyz[2] || 0) * this.pixelsPerMeter;
    return [X, Y, Z];
  }

  unprojectPosition(xyz) {
    const [X, Y] = this.unprojectFlat(xyz);
    const Z = (xyz[2] || 0) / this.pixelsPerMeter;
    return [X, Y, Z];
  }

  /**
   * Project map coordinates to world coordinates.
   * This should be overridden by each viewport that implements a specific
   * geographic projection.
   * @param {Array} xyz - map coordinates
   * @return {Array} [x,y,z] world coordinates.
   */
  projectFlat(xyz, scale = this.scale) {
    return xyz;
  }

  /**
   * Project world coordinates to map coordinates.
   * This should be overridden by each viewport that implements a specific
   * geographic projection.
   * @param {Array} xyz - world coordinates
   * @return {Array} [x,y,z] map coordinates.
   */
  unprojectFlat(xyz, scale = this.scale) {
    return xyz;
  }

}

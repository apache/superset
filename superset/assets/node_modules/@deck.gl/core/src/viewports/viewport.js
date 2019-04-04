// Copyright (c) 2015 - 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import log from '../utils/log';
import {createMat4, extractCameraVectors} from '../utils/math-utils';

import {Matrix4, Vector3, equals} from 'math.gl';
import mat4_scale from 'gl-mat4/scale';
import mat4_translate from 'gl-mat4/translate';
import mat4_multiply from 'gl-mat4/multiply';
import mat4_invert from 'gl-mat4/invert';

import {
  getDistanceScales,
  getWorldPosition,
  getMeterZoom,
  worldToPixels,
  pixelsToWorld
} from 'viewport-mercator-project';

import assert from '../utils/assert';

const DEGREES_TO_RADIANS = Math.PI / 180;

const IDENTITY = createMat4();

const ZERO_VECTOR = [0, 0, 0];

const DEFAULT_DISTANCE_SCALES = {
  pixelsPerMeter: [1, 1, 1],
  metersPerPixel: [1, 1, 1],
  pixelsPerDegree: [1, 1, 1],
  degreesPerPixel: [1, 1, 1]
};

const DEFAULT_ZOOM = 0;

const ERR_ARGUMENT = 'Illegal argument to Viewport';

export default class Viewport {
  /**
   * @classdesc
   * Manages coordinate system transformations for deck.gl.
   *
   * Note: The Viewport is immutable in the sense that it only has accessors.
   * A new viewport instance should be created if any parameters have changed.
   */
  constructor(opts = {}) {
    const {
      id = null,
      // Window width/height in pixels (for pixel projection)
      x = 0,
      y = 0,
      width = 1,
      height = 1
    } = opts;

    this.id = id || this.constructor.displayName || 'viewport';

    this.x = x;
    this.y = y;
    // Silently allow apps to send in w,h = 0,0
    this.width = width || 1;
    this.height = height || 1;

    this._initViewMatrix(opts);
    this._initProjectionMatrix(opts);
    this._initPixelMatrices();

    // Bind methods for easy access
    this.equals = this.equals.bind(this);
    this.project = this.project.bind(this);
    this.unproject = this.unproject.bind(this);
    this.projectFlat = this.projectFlat.bind(this);
    this.unprojectFlat = this.unprojectFlat.bind(this);
    this.getMatrices = this.getMatrices.bind(this);
  }

  // Two viewports are equal if width and height are identical, and if
  // their view and projection matrices are (approximately) equal.
  equals(viewport) {
    if (!(viewport instanceof Viewport)) {
      return false;
    }

    return (
      viewport.width === this.width &&
      viewport.height === this.height &&
      equals(viewport.projectionMatrix, this.projectionMatrix) &&
      equals(viewport.viewMatrix, this.viewMatrix)
    );
    // TODO - check distance scales?
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
   * @return {Array} - [x, y] or [x, y, z] in top left coords
   */
  project(xyz, {topLeft = true} = {}) {
    const [x0, y0, z0 = 0] = xyz;

    const [X, Y] = this.projectFlat([x0, y0]);
    const coord = worldToPixels([X, Y, z0], this.pixelProjectionMatrix);

    const [x, y] = coord;
    const y2 = topLeft ? y : this.height - y;
    return xyz.length === 2 ? [x, y2] : [x, y2, coord[2]];
  }

  /**
   * Unproject pixel coordinates on screen onto world coordinates,
   * (possibly [lon, lat]) on map.
   * - [x, y] => [lng, lat]
   * - [x, y, z] => [lng, lat, Z]
   * @param {Array} xyz -
   * @param {Object} opts - options
   * @param {Object} opts.topLeft=true - Whether origin is top left
   * @return {Array|null} - [lng, lat, Z] or [X, Y, Z]
   */
  unproject(xyz, {topLeft = true, targetZ} = {}) {
    const [x, y, z] = xyz;

    const y2 = topLeft ? y : this.height - y;
    const coord = pixelsToWorld([x, y2, z], this.pixelUnprojectionMatrix, targetZ);
    const [X, Y] = this.unprojectFlat(coord);

    if (Number.isFinite(z)) {
      // Has depth component
      return [X, Y, coord[2]];
    }

    return Number.isFinite(targetZ) ? [X, Y, targetZ] : [X, Y];
  }

  // NON_LINEAR PROJECTION HOOKS
  // Used for web meractor projection

  /**
   * Project [lng,lat] on sphere onto [x,y] on 512*512 Mercator Zoom 0 tile.
   * Performs the nonlinear part of the web mercator projection.
   * Remaining projection is done with 4x4 matrices which also handles
   * perspective.
   * @param {Array} lngLat - [lng, lat] coordinates
   *   Specifies a point on the sphere to project onto the map.
   * @return {Array} [x,y] coordinates.
   */
  projectFlat([x, y], scale = this.scale) {
    return this._projectFlat(...arguments);
  }

  /**
   * Unproject world point [x,y] on map onto {lat, lon} on sphere
   * @param {object|Vector} xy - object with {x,y} members
   *  representing point on projected map plane
   * @return {GeoCoordinates} - object with {lat,lon} of point on sphere.
   *   Has toArray method if you need a GeoJSON Array.
   *   Per cartographic tradition, lat and lon are specified as degrees.
   */
  unprojectFlat(xyz, scale = this.scale) {
    return this._unprojectFlat(...arguments);
  }

  // TODO - why do we need these?
  _projectFlat(xyz, scale = this.scale) {
    return xyz;
  }

  _unprojectFlat(xyz, scale = this.scale) {
    return xyz;
  }

  getMercatorParams() {
    const lngLat = this._addMetersToLngLat(
      [this.longitude || 0, this.latitude || 0],
      this.meterOffset
    );
    return {
      longitude: lngLat[0],
      latitude: lngLat[1]
    };
  }

  isMapSynched() {
    return false;
  }

  getDistanceScales(coordinateOrigin = null) {
    if (coordinateOrigin) {
      return getDistanceScales({
        longitude: coordinateOrigin[0],
        latitude: coordinateOrigin[1],
        scale: this.scale,
        highPrecision: true
      });
    }
    return this.distanceScales;
  }

  getMatrices({modelMatrix = null} = {}) {
    let modelViewProjectionMatrix = this.viewProjectionMatrix;
    let pixelProjectionMatrix = this.pixelProjectionMatrix;
    let pixelUnprojectionMatrix = this.pixelUnprojectionMatrix;

    if (modelMatrix) {
      modelViewProjectionMatrix = mat4_multiply([], this.viewProjectionMatrix, modelMatrix);
      pixelProjectionMatrix = mat4_multiply([], this.pixelProjectionMatrix, modelMatrix);
      pixelUnprojectionMatrix = mat4_invert([], pixelProjectionMatrix);
    }

    const matrices = Object.assign({
      modelViewProjectionMatrix,
      viewProjectionMatrix: this.viewProjectionMatrix,
      viewMatrix: this.viewMatrix,
      projectionMatrix: this.projectionMatrix,

      // project/unproject between pixels and world
      pixelProjectionMatrix,
      pixelUnprojectionMatrix,

      width: this.width,
      height: this.height,
      scale: this.scale
    });

    return matrices;
  }

  // EXPERIMENTAL METHODS

  getCameraPosition() {
    return this.cameraPosition;
  }

  getCameraDirection() {
    return this.cameraDirection;
  }

  getCameraUp() {
    return this.cameraUp;
  }

  // INTERNAL METHODS

  // TODO - these are duplicating WebMercator methods
  _addMetersToLngLat(lngLatZ, xyz) {
    const [lng, lat, Z = 0] = lngLatZ;
    const [deltaLng, deltaLat, deltaZ = 0] = this._metersToLngLatDelta(xyz);
    return lngLatZ.length === 2
      ? [lng + deltaLng, lat + deltaLat]
      : [lng + deltaLng, lat + deltaLat, Z + deltaZ];
  }

  _metersToLngLatDelta(xyz) {
    const [x, y, z = 0] = xyz;
    assert(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z), ERR_ARGUMENT);
    const {pixelsPerMeter, degreesPerPixel} = this.distanceScales;
    const deltaLng = x * pixelsPerMeter[0] * degreesPerPixel[0];
    const deltaLat = y * pixelsPerMeter[1] * degreesPerPixel[1];
    return xyz.length === 2 ? [deltaLng, deltaLat] : [deltaLng, deltaLat, z];
  }

  _createProjectionMatrix({orthographic, fovyRadians, aspect, focalDistance, near, far}) {
    assert(Number.isFinite(fovyRadians));
    return orthographic
      ? new Matrix4().orthographic({fovy: fovyRadians, aspect, focalDistance, near, far})
      : new Matrix4().perspective({fovy: fovyRadians, aspect, near, far});
  }

  /* eslint-disable complexity, max-statements */
  _initViewMatrix(opts) {
    const {
      // view matrix
      viewMatrix = IDENTITY,

      longitude = null, // Anchor: lng lat zoom makes viewport work w/ geospatial coordinate systems
      latitude = null,
      zoom = null,

      position = null, // Anchor position offset (in meters for geospatial viewports)
      modelMatrix = null, // A model matrix to be applied to position, to match the layer props API
      focalDistance = 1, // Only needed for orthographic views

      distanceScales = null
    } = opts;

    // Check if we have a geospatial anchor
    this.isGeospatial = Number.isFinite(latitude) && Number.isFinite(longitude);

    this.zoom = zoom;
    if (!Number.isFinite(this.zoom)) {
      this.zoom = this.isGeospatial
        ? getMeterZoom({latitude}) + Math.log2(focalDistance)
        : DEFAULT_ZOOM;
    }
    this.scale = Math.pow(2, this.zoom);

    // Calculate distance scales if lng/lat/zoom are provided
    this.distanceScales = this.isGeospatial
      ? getDistanceScales({latitude, longitude, scale: this.scale})
      : distanceScales || DEFAULT_DISTANCE_SCALES;

    this.focalDistance = focalDistance;

    this.distanceScales.metersPerPixel = new Vector3(this.distanceScales.metersPerPixel);
    this.distanceScales.pixelsPerMeter = new Vector3(this.distanceScales.pixelsPerMeter);

    this.position = ZERO_VECTOR;
    this.meterOffset = ZERO_VECTOR;
    if (position) {
      // Apply model matrix if supplied
      this.position = position;
      this.modelMatrix = modelMatrix;
      this.meterOffset = modelMatrix ? modelMatrix.transformVector(position) : position;
    }

    this.viewMatrixUncentered = viewMatrix;

    if (this.isGeospatial) {
      // Determine camera center
      this.center = getWorldPosition({
        longitude,
        latitude,
        scale: this.scale,
        distanceScales: this.distanceScales,
        meterOffset: this.meterOffset
      });

      // Make a centered version of the matrix for projection modes without an offset
      this.viewMatrix = new Matrix4()
        // Apply the uncentered view matrix
        .multiplyRight(this.viewMatrixUncentered)
        // The Mercator world coordinate system is upper left,
        // but GL expects lower left, so we flip it around the center after all transforms are done
        .scale([1, -1, 1])
        // And center it
        .translate(new Vector3(this.center || ZERO_VECTOR).negate());
    } else {
      this.center = position;
      this.viewMatrix = viewMatrix;
    }
  }
  /* eslint-enable complexity, max-statements */

  _initProjectionMatrix(opts) {
    const {
      // Projection matrix
      projectionMatrix = null,

      // Projection matrix parameters, used if projectionMatrix not supplied
      orthographic = false,
      fovyRadians,
      fovyDegrees,
      fovy,
      near = 0.1, // Distance of near clipping plane
      far = 1000, // Distance of far clipping plane
      focalDistance = 1, // Only needed for orthographic views
      orthographicFocalDistance
    } = opts;

    const radians = fovyRadians || (fovyDegrees || fovy || 75) * DEGREES_TO_RADIANS;

    this.projectionMatrix =
      projectionMatrix ||
      this._createProjectionMatrix({
        orthographic,
        fovyRadians: radians,
        aspect: this.width / this.height,
        focalDistance: orthographicFocalDistance || focalDistance,
        near,
        far
      });
  }

  _initPixelMatrices() {
    // Note: As usual, matrix operations should be applied in "reverse" order
    // since vectors will be multiplied in from the right during transformation
    const vpm = createMat4();
    mat4_multiply(vpm, vpm, this.projectionMatrix);
    mat4_multiply(vpm, vpm, this.viewMatrix);
    this.viewProjectionMatrix = vpm;

    // console.log('VPM', this.viewMatrix, this.projectionMatrix, this.viewProjectionMatrix);

    // Calculate inverse view matrix
    this.viewMatrixInverse = mat4_invert([], this.viewMatrix) || this.viewMatrix;

    // Decompose camera directions
    const {eye, direction, up} = extractCameraVectors({
      viewMatrix: this.viewMatrix,
      viewMatrixInverse: this.viewMatrixInverse
    });
    this.cameraPosition = eye;
    this.cameraDirection = direction;
    this.cameraUp = up;

    // console.log(this.cameraPosition, this.cameraDirection, this.cameraUp);

    /*
     * Builds matrices that converts preprojected lngLats to screen pixels
     * and vice versa.
     * Note: Currently returns bottom-left coordinates!
     * Note: Starts with the GL projection matrix and adds steps to the
     *       scale and translate that matrix onto the window.
     * Note: WebGL controls clip space to screen projection with gl.viewport
     *       and does not need this step.
     */

    // matrix for conversion from world location to screen (pixel) coordinates
    const m = createMat4();
    mat4_scale(m, m, [this.width / 2, -this.height / 2, 1]);
    mat4_translate(m, m, [1, -1, 0]);
    mat4_multiply(m, m, this.viewProjectionMatrix);
    this.pixelProjectionMatrix = m;

    this.pixelUnprojectionMatrix = mat4_invert(createMat4(), this.pixelProjectionMatrix);
    if (!this.pixelUnprojectionMatrix) {
      log.warn('Pixel project matrix not invertible')();
      // throw new Error('Pixel project matrix not invertible');
    }
  }
}

Viewport.displayName = 'Viewport';

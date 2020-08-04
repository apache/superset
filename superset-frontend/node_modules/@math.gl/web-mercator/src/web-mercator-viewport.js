// View and Projection Matrix calculations for mapbox-js style map view properties
import {createMat4} from './math-utils';

import {
  zoomToScale,
  pixelsToWorld,
  lngLatToWorld,
  worldToLngLat,
  worldToPixels,
  getProjectionMatrix,
  getDistanceScales,
  getViewMatrix
} from './web-mercator-utils';
import fitBounds from './fit-bounds';
import getBounds from './get-bounds';

import * as mat4 from 'gl-matrix/mat4';
import * as vec2 from 'gl-matrix/vec2';

export default class WebMercatorViewport {
  // eslint-disable-next-line max-statements
  constructor(
    {
      // Map state
      width,
      height,
      latitude = 0,
      longitude = 0,
      zoom = 0,
      pitch = 0,
      bearing = 0,
      altitude = 1.5,
      nearZMultiplier = 0.02,
      farZMultiplier = 1.01
    } = {width: 1, height: 1}
  ) {
    // Silently allow apps to send in 0,0 to facilitate isomorphic render etc
    width = width || 1;
    height = height || 1;

    const scale = zoomToScale(zoom);
    // Altitude - prevent division by 0
    // TODO - just throw an Error instead?
    altitude = Math.max(0.75, altitude);

    const center = lngLatToWorld([longitude, latitude]);
    center[2] = 0;

    this.projectionMatrix = getProjectionMatrix({
      width,
      height,
      pitch,
      altitude,
      nearZMultiplier,
      farZMultiplier
    });

    this.viewMatrix = getViewMatrix({
      height,
      scale,
      center,
      pitch,
      bearing,
      altitude
    });

    // Save parameters
    this.width = width;
    this.height = height;
    this.scale = scale;

    this.latitude = latitude;
    this.longitude = longitude;
    this.zoom = zoom;
    this.pitch = pitch;
    this.bearing = bearing;
    this.altitude = altitude;
    this.center = center;

    this.distanceScales = getDistanceScales(this);

    this._initMatrices();

    // Bind methods for easy access
    this.equals = this.equals.bind(this);
    this.project = this.project.bind(this);
    this.unproject = this.unproject.bind(this);
    this.projectPosition = this.projectPosition.bind(this);
    this.unprojectPosition = this.unprojectPosition.bind(this);

    Object.freeze(this);
  }

  _initMatrices() {
    const {width, height, projectionMatrix, viewMatrix} = this;

    // Note: As usual, matrix operations should be applied in "reverse" order
    // since vectors will be multiplied in from the right during transformation
    const vpm = createMat4();
    mat4.multiply(vpm, vpm, projectionMatrix);
    mat4.multiply(vpm, vpm, viewMatrix);
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
    mat4.scale(m, m, [width / 2, -height / 2, 1]);
    mat4.translate(m, m, [1, -1, 0]);
    mat4.multiply(m, m, vpm);

    const mInverse = mat4.invert(createMat4(), m);
    if (!mInverse) {
      throw new Error('Pixel project matrix not invertible');
    }

    this.pixelProjectionMatrix = m;
    this.pixelUnprojectionMatrix = mInverse;
  }

  // Two viewports are equal if width and height are identical, and if
  // their view and projection matrices are (approximately) equal.
  equals(viewport) {
    if (!(viewport instanceof WebMercatorViewport)) {
      return false;
    }

    return (
      viewport.width === this.width &&
      viewport.height === this.height &&
      mat4.equals(viewport.projectionMatrix, this.projectionMatrix) &&
      mat4.equals(viewport.viewMatrix, this.viewMatrix)
    );
  }

  // Projects xyz (possibly latitude and longitude) to pixel coordinates in window
  // using viewport projection parameters
  project(xyz, {topLeft = true} = {}) {
    const worldPosition = this.projectPosition(xyz);
    const coord = worldToPixels(worldPosition, this.pixelProjectionMatrix);

    const [x, y] = coord;
    const y2 = topLeft ? y : this.height - y;
    return xyz.length === 2 ? [x, y2] : [x, y2, coord[2]];
  }

  // Unproject pixel coordinates on screen onto world coordinates,
  // (possibly [lon, lat]) on map.
  unproject(xyz, {topLeft = true, targetZ = undefined} = {}) {
    const [x, y, z] = xyz;

    const y2 = topLeft ? y : this.height - y;
    const targetZWorld = targetZ && targetZ * this.distanceScales.unitsPerMeter[2];
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
    const [X, Y] = lngLatToWorld(xyz);
    const Z = (xyz[2] || 0) * this.distanceScales.unitsPerMeter[2];
    return [X, Y, Z];
  }

  unprojectPosition(xyz) {
    const [X, Y] = worldToLngLat(xyz);
    const Z = (xyz[2] || 0) * this.distanceScales.metersPerUnit[2];
    return [X, Y, Z];
  }

  // Project [lng,lat] on sphere onto [x,y] on 512*512 Mercator Zoom 0 tile.
  projectFlat(lngLat) {
    return lngLatToWorld(lngLat);
  }

  // Unproject world point [x,y] on map onto {lat, lon} on sphere
  unprojectFlat(xy) {
    return worldToLngLat(xy);
  }

  // Get the map center that place a given [lng, lat] coordinate at screen point [x, y]
  getMapCenterByLngLatPosition({lngLat, pos}) {
    const fromLocation = pixelsToWorld(pos, this.pixelUnprojectionMatrix);
    const toLocation = lngLatToWorld(lngLat);

    const translate = vec2.add([], toLocation, vec2.negate([], fromLocation));
    const newCenter = vec2.add([], this.center, translate);

    return worldToLngLat(newCenter);
  }

  // Legacy method name
  getLocationAtPoint({lngLat, pos}) {
    return this.getMapCenterByLngLatPosition({lngLat, pos});
  }

  // Returns a new viewport that fit around the given rectangle.
  fitBounds(bounds, options = {}) {
    const {width, height} = this;
    const {longitude, latitude, zoom} = fitBounds(Object.assign({width, height, bounds}, options));
    return new WebMercatorViewport({width, height, longitude, latitude, zoom});
  }

  getBounds(options) {
    const corners = this.getBoundingRegion(options);

    const west = Math.min(...corners.map(p => p[0]));
    const east = Math.max(...corners.map(p => p[0]));
    const south = Math.min(...corners.map(p => p[1]));
    const north = Math.max(...corners.map(p => p[1]));
    return [[west, south], [east, north]];
  }

  getBoundingRegion(options = {}) {
    return getBounds(this, options.z || 0);
  }
}

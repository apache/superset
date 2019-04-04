// TODO - THE UTILITIES IN THIS FILE SHOULD BE IMPORTED FROM WEB-MERCATOR-VIEWPORT MODULE

import {Vector3} from 'math.gl';
import {createMat4, transformVector} from './math-utils';

import mat4_perspective from 'gl-mat4/perspective';
import mat4_scale from 'gl-mat4/scale';
import mat4_translate from 'gl-mat4/translate';
import mat4_rotateX from 'gl-mat4/rotateX';
import mat4_rotateZ from 'gl-mat4/rotateZ';
import vec2_lerp from 'gl-vec2/lerp';
import assert from './assert';

// CONSTANTS
const PI = Math.PI;
const PI_4 = PI / 4;
const DEGREES_TO_RADIANS = PI / 180;
const RADIANS_TO_DEGREES = 180 / PI;
const TILE_SIZE = 512;
// Average circumference (40075 km equatorial, 40007 km meridional)
const EARTH_CIRCUMFERENCE = 40.03e6;

// Mapbox default altitude
const DEFAULT_ALTITUDE = 1.5;

/** Util functions **/
export function zoomToScale(zoom) {
  return Math.pow(2, zoom);
}

export function scaleToZoom(scale) {
  return Math.log2(scale);
}

/**
 * Project [lng,lat] on sphere onto [x,y] on 512*512 Mercator Zoom 0 tile.
 * Performs the nonlinear part of the web mercator projection.
 * Remaining projection is done with 4x4 matrices which also handles
 * perspective.
 *
 * @param {Array} lngLat - [lng, lat] coordinates
 *   Specifies a point on the sphere to project onto the map.
 * @return {Array} [x,y] coordinates.
 */
export function lngLatToWorld([lng, lat], scale) {
  scale *= TILE_SIZE;
  const lambda2 = lng * DEGREES_TO_RADIANS;
  const phi2 = lat * DEGREES_TO_RADIANS;
  const x = scale * (lambda2 + PI) / (2 * PI);
  const y = scale * (PI - Math.log(Math.tan(PI_4 + phi2 * 0.5))) / (2 * PI);
  return [x, y];
}

/**
 * Unproject world point [x,y] on map onto {lat, lon} on sphere
 *
 * @param {object|Vector} xy - object with {x,y} members
 *  representing point on projected map plane
 * @return {GeoCoordinates} - object with {lat,lon} of point on sphere.
 *   Has toArray method if you need a GeoJSON Array.
 *   Per cartographic tradition, lat and lon are specified as degrees.
 */
export function worldToLngLat([x, y], scale) {
  scale *= TILE_SIZE;
  const lambda2 = (x / scale) * (2 * PI) - PI;
  const phi2 = 2 * (Math.atan(Math.exp(PI - (y / scale) * (2 * PI))) - PI_4);
  return [lambda2 * RADIANS_TO_DEGREES, phi2 * RADIANS_TO_DEGREES];
}

// Returns the zoom level that gives a 1 meter pixel at a certain latitude
// 1 = C*cos(y)/2^z/TILE_SIZE = C*cos(y)/2^(z+9)
export function getMeterZoom({latitude}) {
  assert(Number.isFinite(latitude));
  const latCosine = Math.cos(latitude * DEGREES_TO_RADIANS);
  return scaleToZoom(EARTH_CIRCUMFERENCE * latCosine) - 9;
}

/**
 * Calculate distance scales in meters around current lat/lon, both for
 * degrees and pixels.
 * In mercator projection mode, the distance scales vary significantly
 * with latitude.
 */
export function getDistanceScales({latitude, longitude, zoom, scale, highPrecision = false}) {
  // Calculate scale from zoom if not provided
  scale = scale !== undefined ? scale : zoomToScale(zoom);

  assert(Number.isFinite(latitude) && Number.isFinite(longitude) && Number.isFinite(scale));

  const result = {};
  const worldSize = TILE_SIZE * scale;
  const latCosine = Math.cos(latitude * DEGREES_TO_RADIANS);

  /**
   * Number of pixels occupied by one degree longitude around current lat/lon:
     pixelsPerDegreeX = d(lngLatToWorld([lng, lat])[0])/d(lng)
       = scale * TILE_SIZE * DEGREES_TO_RADIANS / (2 * PI)
     pixelsPerDegreeY = d(lngLatToWorld([lng, lat])[1])/d(lat)
       = -scale * TILE_SIZE * DEGREES_TO_RADIANS / cos(lat * DEGREES_TO_RADIANS)  / (2 * PI)
   */
  const pixelsPerDegreeX = worldSize / 360;
  const pixelsPerDegreeY = pixelsPerDegreeX / latCosine;

  /**
   * Number of pixels occupied by one meter around current lat/lon:
   */
  const altPixelsPerMeter = worldSize / EARTH_CIRCUMFERENCE / latCosine;

  result.pixelsPerMeter = [altPixelsPerMeter, altPixelsPerMeter, altPixelsPerMeter];
  result.metersPerPixel = [1 / altPixelsPerMeter, 1 / altPixelsPerMeter, 1 / altPixelsPerMeter];

  result.pixelsPerDegree = [pixelsPerDegreeX, pixelsPerDegreeY, altPixelsPerMeter];
  result.degreesPerPixel = [1 / pixelsPerDegreeX, 1 / pixelsPerDegreeY, 1 / altPixelsPerMeter];

  /**
   * Taylor series 2nd order for 1/latCosine
     f'(a) * (x - a)
       = d(1/cos(lat * DEGREES_TO_RADIANS))/d(lat) * dLat
       = DEGREES_TO_RADIANS * tan(lat * DEGREES_TO_RADIANS) / cos(lat * DEGREES_TO_RADIANS) * dLat
   */
  if (highPrecision) {
    const latCosine2 = DEGREES_TO_RADIANS * Math.tan(latitude * DEGREES_TO_RADIANS) / latCosine;
    const pixelsPerDegreeY2 = pixelsPerDegreeX * latCosine2 / 2;
    const altPixelsPerDegree2 = worldSize / EARTH_CIRCUMFERENCE * latCosine2;
    const altPixelsPerMeter2 = altPixelsPerDegree2 / pixelsPerDegreeY * altPixelsPerMeter;

    result.pixelsPerDegree2 = [0, pixelsPerDegreeY2, altPixelsPerDegree2];
    result.pixelsPerMeter2 = [altPixelsPerMeter2, 0, altPixelsPerMeter2];
  }

  // Main results, used for converting meters to latlng deltas and scaling offsets
  return result;
}

/**
 * Calculates a mercator world position ("pixels" in given zoom level)
 * from a lng/lat and meterOffset
 */
export function getWorldPosition({
  longitude,
  latitude,
  zoom,
  scale,
  meterOffset,
  distanceScales = null
}) {
  // Calculate scale from zoom if not provided
  scale = scale !== undefined ? scale : zoomToScale(zoom);

  // Make a centered version of the matrix for projection modes without an offset
  const center2d = lngLatToWorld([longitude, latitude], scale);
  const center = new Vector3(center2d[0], center2d[1], 0);

  if (meterOffset) {
    // Calculate distance scales if lng/lat/zoom are provided
    distanceScales = distanceScales || getDistanceScales({latitude, longitude, scale});

    const pixelPosition = new Vector3(meterOffset)
      // Convert to pixels in current zoom
      .scale(distanceScales.pixelsPerMeter)
      // We want positive Y to represent an offset towards north,
      // but web mercator world coordinates is top-left
      .scale([1, -1, 1]);
    center.add(pixelPosition);
  }

  return center;
}

// ATTRIBUTION:
// view and projection matrix creation is intentionally kept compatible with
// mapbox-gl's implementation to ensure that seamless interoperation
// with mapbox and react-map-gl. See: https://github.com/mapbox/mapbox-gl-js

export function getViewMatrix({
  // Viewport props
  height,
  pitch,
  bearing,
  altitude,
  // Pre-calculated parameters
  center = null,
  // Options
  flipY = false
}) {

  // VIEW MATRIX: PROJECTS MERCATOR WORLD COORDINATES
  // Note that mercator world coordinates typically need to be flipped
  //
  // Note: As usual, matrix operation orders should be read in reverse
  // since vectors will be multiplied from the right during transformation
  const vm = createMat4();

  // Move camera to altitude (along the pitch & bearing direction)
  mat4_translate(vm, vm, [0, 0, -altitude]);

  // After the rotateX, z values are in pixel units. Convert them to
  // altitude units. 1 altitude unit = the screen height.
  mat4_scale(vm, vm, [1, 1, 1 / height]);

  // Rotate by bearing, and then by pitch (which tilts the view)
  mat4_rotateX(vm, vm, -pitch * DEGREES_TO_RADIANS);
  mat4_rotateZ(vm, vm, bearing * DEGREES_TO_RADIANS);

  if (flipY) {
    mat4_scale(vm, vm, [1, -1, 1]);
  }

  if (center) {
    mat4_translate(vm, vm, new Vector3(center).negate());
  }

  return vm;
}

// PROJECTION MATRIX PARAMETERS
// This is a "Mapbox" projection matrix - matches mapbox exactly if farZMultiplier === 1
// Variable fov (in radians)
export function getProjectionParameters({
  width,
  height,
  altitude = DEFAULT_ALTITUDE,
  pitch = 0,
  farZMultiplier = 1
}) {
  // Find the distance from the center point to the center top
  // in altitude units using law of sines.
  const pitchRadians = pitch * DEGREES_TO_RADIANS;
  const halfFov = Math.atan(0.5 / altitude);
  const topHalfSurfaceDistance =
    Math.sin(halfFov) * altitude / Math.sin(Math.PI / 2 - pitchRadians - halfFov);

  // Calculate z value of the farthest fragment that should be rendered.
  const farZ = Math.cos(Math.PI / 2 - pitchRadians) * topHalfSurfaceDistance + altitude;

  return {
    fov: 2 * Math.atan((height / 2) / altitude),
    aspect: width / height,
    focalDistance: altitude,
    near: 0.1,
    far: farZ * farZMultiplier
  };
}

// PROJECTION MATRIX: PROJECTS FROM CAMERA (VIEW) SPACE TO CLIPSPACE
// This is a "Mapbox" projection matrix - matches mapbox exactly if farZMultiplier === 1
// Variable fov (in radians)
export function getProjectionMatrix({
  width,
  height,
  pitch,
  altitude,
  farZMultiplier = 10
}) {
  const {fov, aspect, near, far} =
    getProjectionParameters({width, height, altitude, pitch, farZMultiplier});

  const projectionMatrix = mat4_perspective(
    [],
    fov,      // fov in radians
    aspect,   // aspect ratio
    near,     // near plane
    far       // far plane
  );

  return projectionMatrix;
}

/**
 * Project flat coordinates to pixels on screen.
 *
 * @param {Array} xyz - flat coordinate on 512*512 Mercator Zoom 0 tile
 * @param {Matrix4} pixelProjectionMatrix - projection matrix
 * @return {Array} [x, y, depth] pixel coordinate on screen.
 */
export function worldToPixels(xyz, pixelProjectionMatrix) {
  const [x, y, z = 0] = xyz;
  assert(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z));

  return transformVector(pixelProjectionMatrix, [x, y, z, 1]);
}

/**
 * Unproject pixels on screen to flat coordinates.
 *
 * @param {Array} xyz - pixel coordinate on screen.
 * @param {Matrix4} pixelUnprojectionMatrix - unprojection matrix
 * @param {Number} targetZ - if pixel coordinate does not have a 3rd component (depth),
 *    targetZ is used as the elevation plane to unproject onto
 * @return {Array} [x, y, Z] flat coordinates on 512*512 Mercator Zoom 0 tile.
 */
export function pixelsToWorld(xyz, pixelUnprojectionMatrix, targetZ = 0) {
  const [x, y, z] = xyz;
  assert(Number.isFinite(x) && Number.isFinite(y));

  if (Number.isFinite(z)) {
    // Has depth component
    const coord = transformVector(pixelUnprojectionMatrix, [x, y, z, 1]);
    return coord;
  }

  // since we don't know the correct projected z value for the point,
  // unproject two points to get a line and then find the point on that line with z=0
  const coord0 = transformVector(pixelUnprojectionMatrix, [x, y, 0, 1]);
  const coord1 = transformVector(pixelUnprojectionMatrix, [x, y, 1, 1]);

  const z0 = coord0[2];
  const z1 = coord1[2];

  const t = z0 === z1 ? 0 : ((targetZ || 0) - z0) / (z1 - z0);
  return vec2_lerp([], coord0, coord1, t);
}

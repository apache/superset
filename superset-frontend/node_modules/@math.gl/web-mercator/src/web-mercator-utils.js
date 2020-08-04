// TODO - THE UTILITIES IN THIS FILE SHOULD BE IMPORTED FROM WEB-MERCATOR-VIEWPORT MODULE

import {createMat4, transformVector} from './math-utils';

import * as mat4 from 'gl-matrix/mat4';
import * as vec2 from 'gl-matrix/vec2';
import * as vec3 from 'gl-matrix/vec3';
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
 * @param lngLat - [lng, lat] coordinates
 *   Specifies a point on the sphere to project onto the map.
 * @return [x,y] coordinates.
 */
export function lngLatToWorld([lng, lat]) {
  assert(Number.isFinite(lng));
  assert(Number.isFinite(lat) && lat >= -90 && lat <= 90, 'invalid latitude');

  const lambda2 = lng * DEGREES_TO_RADIANS;
  const phi2 = lat * DEGREES_TO_RADIANS;
  const x = (TILE_SIZE * (lambda2 + PI)) / (2 * PI);
  const y = (TILE_SIZE * (PI + Math.log(Math.tan(PI_4 + phi2 * 0.5)))) / (2 * PI);
  return [x, y];
}

// Unproject world point [x,y] on map onto {lat, lon} on sphere
export function worldToLngLat([x, y]) {
  const lambda2 = (x / TILE_SIZE) * (2 * PI) - PI;
  const phi2 = 2 * (Math.atan(Math.exp((y / TILE_SIZE) * (2 * PI) - PI)) - PI_4);
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

export function getDistanceScales({latitude, longitude, highPrecision = false}) {
  assert(Number.isFinite(latitude) && Number.isFinite(longitude));

  const result = {};
  const worldSize = TILE_SIZE;
  const latCosine = Math.cos(latitude * DEGREES_TO_RADIANS);

  /**
   * Number of pixels occupied by one degree longitude around current lat/lon:
     unitsPerDegreeX = d(lngLatToWorld([lng, lat])[0])/d(lng)
       = scale * TILE_SIZE * DEGREES_TO_RADIANS / (2 * PI)
     unitsPerDegreeY = d(lngLatToWorld([lng, lat])[1])/d(lat)
       = -scale * TILE_SIZE * DEGREES_TO_RADIANS / cos(lat * DEGREES_TO_RADIANS)  / (2 * PI)
   */
  const unitsPerDegreeX = worldSize / 360;
  const unitsPerDegreeY = unitsPerDegreeX / latCosine;

  /**
   * Number of pixels occupied by one meter around current lat/lon:
   */
  const altUnitsPerMeter = worldSize / EARTH_CIRCUMFERENCE / latCosine;

  /**
   * LngLat: longitude -> east and latitude -> north (bottom left)
   * UTM meter offset: x -> east and y -> north (bottom left)
   * World space: x -> east and y -> south (top left)
   *
   * Y needs to be flipped when converting delta degree/meter to delta pixels
   */
  result.unitsPerMeter = [altUnitsPerMeter, altUnitsPerMeter, altUnitsPerMeter];
  result.metersPerUnit = [1 / altUnitsPerMeter, 1 / altUnitsPerMeter, 1 / altUnitsPerMeter];

  result.unitsPerDegree = [unitsPerDegreeX, unitsPerDegreeY, altUnitsPerMeter];
  result.degreesPerUnit = [1 / unitsPerDegreeX, 1 / unitsPerDegreeY, 1 / altUnitsPerMeter];

  /**
   * Taylor series 2nd order for 1/latCosine
     f'(a) * (x - a)
       = d(1/cos(lat * DEGREES_TO_RADIANS))/d(lat) * dLat
       = DEGREES_TO_RADIANS * tan(lat * DEGREES_TO_RADIANS) / cos(lat * DEGREES_TO_RADIANS) * dLat
   */
  if (highPrecision) {
    const latCosine2 = (DEGREES_TO_RADIANS * Math.tan(latitude * DEGREES_TO_RADIANS)) / latCosine;
    const unitsPerDegreeY2 = (unitsPerDegreeX * latCosine2) / 2;
    const altUnitsPerDegree2 = (worldSize / EARTH_CIRCUMFERENCE) * latCosine2;
    const altUnitsPerMeter2 = (altUnitsPerDegree2 / unitsPerDegreeY) * altUnitsPerMeter;

    result.unitsPerDegree2 = [0, unitsPerDegreeY2, altUnitsPerDegree2];
    result.unitsPerMeter2 = [altUnitsPerMeter2, 0, altUnitsPerMeter2];
  }

  // Main results, used for converting meters to latlng deltas and scaling offsets
  return result;
}

/**
 * Offset a lng/lat position by meterOffset (northing, easting)
 */
export function addMetersToLngLat(lngLatZ, xyz) {
  const [longitude, latitude, z0] = lngLatZ;
  const [x, y, z] = xyz;

  const {unitsPerMeter, unitsPerMeter2} = getDistanceScales({
    longitude,
    latitude,
    highPrecision: true
  });

  const worldspace = lngLatToWorld(lngLatZ);
  worldspace[0] += x * (unitsPerMeter[0] + unitsPerMeter2[0] * y);
  worldspace[1] += y * (unitsPerMeter[1] + unitsPerMeter2[1] * y);

  // @ts-ignore
  const newLngLat = worldToLngLat(worldspace);
  const newZ = (z0 || 0) + (z || 0);

  return Number.isFinite(z0) || Number.isFinite(z) ? [newLngLat[0], newLngLat[1], newZ] : newLngLat;
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
  scale,
  center = null
}) {
  // VIEW MATRIX: PROJECTS MERCATOR WORLD COORDINATES
  // Note that mercator world coordinates typically need to be flipped
  //
  // Note: As usual, matrix operation orders should be read in reverse
  // since vectors will be multiplied from the right during transformation
  const vm = createMat4();

  // Move camera to altitude (along the pitch & bearing direction)
  mat4.translate(vm, vm, [0, 0, -altitude]);

  // Rotate by bearing, and then by pitch (which tilts the view)
  mat4.rotateX(vm, vm, -pitch * DEGREES_TO_RADIANS);
  mat4.rotateZ(vm, vm, bearing * DEGREES_TO_RADIANS);

  scale /= height;
  mat4.scale(vm, vm, [scale, scale, scale]);

  if (center) {
    mat4.translate(vm, vm, vec3.negate([], center));
  }

  return vm;
}

// PROJECTION MATRIX PARAMETERS
// Variable fov (in radians)
export function getProjectionParameters({
  width,
  height,
  altitude = DEFAULT_ALTITUDE,
  pitch = 0,
  nearZMultiplier = 1,
  farZMultiplier = 1
}) {
  // Find the distance from the center point to the center top
  // in altitude units using law of sines.
  const pitchRadians = pitch * DEGREES_TO_RADIANS;
  const halfFov = Math.atan(0.5 / altitude);
  const topHalfSurfaceDistance =
    (Math.sin(halfFov) * altitude) /
    Math.sin(Math.min(Math.max(Math.PI / 2 - pitchRadians - halfFov, 0.01), Math.PI - 0.01));

  // Calculate z value of the farthest fragment that should be rendered.
  const farZ = Math.sin(pitchRadians) * topHalfSurfaceDistance + altitude;

  return {
    fov: 2 * halfFov,
    aspect: width / height,
    focalDistance: altitude,
    near: nearZMultiplier,
    far: farZ * farZMultiplier
  };
}

// PROJECTION MATRIX: PROJECTS FROM CAMERA (VIEW) SPACE TO CLIPSPACE
// To match mapbox's z buffer:
// <= 0.28 - nearZMultiplier: 0.1, farZmultiplier: 1
// >= 0.29 - nearZMultiplier: 1 / height, farZMultiplier: 1.01
export function getProjectionMatrix({
  width,
  height,
  pitch,
  altitude,
  nearZMultiplier,
  farZMultiplier
}) {
  const {fov, aspect, near, far} = getProjectionParameters({
    width,
    height,
    altitude,
    pitch,
    nearZMultiplier,
    farZMultiplier
  });

  const projectionMatrix = mat4.perspective(
    [],
    fov, // fov in radians
    aspect, // aspect ratio
    near, // near plane
    far // far plane
  );

  return projectionMatrix;
}

// Project flat coordinates to pixels on screen.
export function worldToPixels(xyz, pixelProjectionMatrix) {
  const [x, y, z = 0] = xyz;
  assert(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z));

  return transformVector(pixelProjectionMatrix, [x, y, z, 1]);
}

// Unproject pixels on screen to flat coordinates.
export function pixelsToWorld(xyz, pixelUnprojectionMatrix, targetZ = 0) {
  const [x, y, z] = xyz;
  assert(Number.isFinite(x) && Number.isFinite(y), 'invalid pixel coordinate');

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
  return vec2.lerp([], coord0, coord1, t);
}

// TODO - THE UTILITIES IN THIS FILE SHOULD BE IMPORTED FROM WEB-MERCATOR-VIEWPORT MODULE

/** Util functions **/
export function zoomToScale(zoom: number): number;

export function scaleToZoom(scale: number): number;

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
export function lngLatToWorld(lngLat: number[]): number[];

/**
 * Unproject world point [x,y] on map onto {lat, lon} on sphere
 *
 * @param xy - array with [x,y] members
 *  representing point on projected map plane
 * @return - array with [x,y] of point on sphere.
 *   Has toArray method if you need a GeoJSON Array.
 *   Per cartographic tradition, lat and lon are specified as degrees.
 */
export function worldToLngLat(xy: number[]): number[];

// Returns the zoom level that gives a 1 meter pixel at a certain latitude
// 1 = C*cos(y)/2^z/TILE_SIZE = C*cos(y)/2^(z+9)
export function getMeterZoom(options: {latitude: number}): number;

export type DistanceScales = {
  unitsPerMeter: number[];
  metersPerUnit: number[];
  unitsPerMeter2?: number[];
  unitsPerDegree: number[];
  degreesPerUnit: number[];
  unitsPerDegree2?: number[];
};

/**
 * Calculate distance scales in meters around current lat/lon, both for
 * degrees and pixels.
 * In mercator projection mode, the distance scales vary significantly
 * with latitude.
 */
export function getDistanceScales(options: {
  latitude: number;
  longitude: number;
  highPrecision?: boolean;
}): DistanceScales;

/**
 * Offset a lng/lat position by meterOffset (northing, easting)
 */
export function addMetersToLngLat(lngLatZ: number[], xyz: number[]): number[];

// ATTRIBUTION:
// view and projection matrix creation is intentionally kept compatible with
// mapbox-gl's implementation to ensure that seamless interoperation
// with mapbox and react-map-gl. See: https://github.com/mapbox/mapbox-gl-js

export function getViewMatrix(options: {
  // Viewport props
  height: number;
  pitch: number;
  bearing: number;
  altitude: number;
  // Pre-calculated parameters
  scale: number;
  center: number[];
}): number[];

/**
 * PROJECTION MATRIX PARAMETERS
 *
 * TODO how to document mebers
 * @param fov in radians. fov is variable, depends on pitch and altitude
 * @param aspect width/height
 * @param focalDistance distance at which visual scale factor is 1
 * @param near near clipping plane
 * @param far far clipping plane
 */
type ProjectionParameters = {
  fov: number;
  aspect: number;
  focalDistance: number;
  near: number;
  far: number;
};

/**
 * Valculates mapbox compatible projection matrix from parameters
// Note: This matrix has variable fov (specified in radians)
 *
 * @param options.width Width of "viewport" or window
 * @param options.height Height of "viewport" or window
 * @param options.pitch Camera angle in degrees (0 is straight down)
 * @param options.altitude of camera in screen units
 * @param options.nearZMultiplier control z buffer
 * @param options.farZMultiplier control z buffer
 * @returns project parameters object
 */
export function getProjectionParameters(options: {
  width: number;
  height: number;
  altitude?: number;
  pitch?: number;
  nearZMultiplier?: number;
  farZMultiplier?: number;
}): ProjectionParameters;

/**
 * CALCULATE PROJECTION MATRIX: PROJECTS FROM CAMERA (VIEW) SPACE TO CLIPSPACE
 *
 * To match mapbox's z buffer:
 *  - \<= 0.28: nearZMultiplier: 0.1, farZmultiplier: 1
 *  - \>= 0.29: nearZMultiplier: 1 / height, farZMultiplier: 1.01
 *
 * @param options Viewport options
 * @param options.width Width of "viewport" or window
 * @param options.height Height of "viewport" or window
 * @param options.pitch Camera angle in degrees (0 is straight down)
 * @param options.altitude of camera in screen units
 * @param options.nearZMultiplier control z buffer
 * @param options.farZMultiplier control z buffer
 * @returns 4x4 projection matrix
 */
export function getProjectionMatrix(options: {
  width: number;
  height: number;
  pitch: number;
  altitude: number;
  nearZMultiplier: number;
  farZMultiplier: number;
}): number[];

/**
 * Project flat coordinates to pixels on screen.
 *
 * @param xyz - flat coordinate on 512*512 Mercator Zoom 0 tile
 * @param pixelProjectionMatrix - projection matrix 4x4
 * @return [x, y, depth] pixel coordinate on screen.
 */
export function worldToPixels(xyz: number[], pixelProjectionMatrix: number[]): number[];

/**
 * Unproject pixels on screen to flat coordinates.
 *
 * @param xyz - pixel coordinate on screen.
 * @param pixelUnprojectionMatrix - unprojection matrix 4x4
 * @param targetZ - if pixel coordinate does not have a 3rd component (depth),
 *    targetZ is used as the elevation plane to unproject onto
 * @return [x, y, Z] flat coordinates on 512*512 Mercator Zoom 0 tile.
 */
export function pixelsToWorld(
  xyz: number[],
  pixelUnprojectionMatrix: number[],
  targetZ?: number
): number[];

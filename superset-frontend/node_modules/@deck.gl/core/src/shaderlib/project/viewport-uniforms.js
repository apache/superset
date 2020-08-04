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

import * as mat4 from 'gl-matrix/mat4';
import * as vec4 from 'gl-matrix/vec4';

import {COORDINATE_SYSTEM} from '../../lib/constants';

import memoize from '../../utils/memoize';
import assert from '../../utils/assert';

import {PROJECT_COORDINATE_SYSTEM} from './constants';

// To quickly set a vector to zero
const ZERO_VECTOR = [0, 0, 0, 0];
// 4x4 matrix that drops 4th component of vector
const VECTOR_TO_POINT_MATRIX = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0];
const IDENTITY_MATRIX = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const DEFAULT_PIXELS_PER_UNIT2 = [0, 0, 0];
const DEFAULT_COORDINATE_ORIGIN = [0, 0, 0];

// Based on viewport-mercator-project/test/fp32-limits.js
export const LNGLAT_AUTO_OFFSET_ZOOM_THRESHOLD = 12;

const getMemoizedViewportUniforms = memoize(calculateViewportUniforms);

function getShaderCoordinateSystem(coordinateSystem) {
  switch (coordinateSystem) {
    case COORDINATE_SYSTEM.LNGLAT:
    case COORDINATE_SYSTEM.LNGLAT_EXPERIMENTAL:
    default:
      return PROJECT_COORDINATE_SYSTEM.LNGLAT_AUTO_OFFSET;

    case COORDINATE_SYSTEM.LNGLAT_DEPRECATED:
      return PROJECT_COORDINATE_SYSTEM.LNG_LAT;

    case COORDINATE_SYSTEM.METER_OFFSETS:
    case COORDINATE_SYSTEM.METERS:
      return PROJECT_COORDINATE_SYSTEM.METER_OFFSETS;

    case COORDINATE_SYSTEM.LNGLAT_OFFSETS:
      return PROJECT_COORDINATE_SYSTEM.LNGLAT_OFFSETS;

    case COORDINATE_SYSTEM.IDENTITY:
      return PROJECT_COORDINATE_SYSTEM.IDENTITY;
  }
}

// The code that utilizes Matrix4 does the same calculation as their mat4 counterparts,
// has lower performance but provides error checking.
// Uncomment when debugging
function calculateMatrixAndOffset({
  // UNCHANGED
  viewport,
  // NEW PARAMS
  coordinateSystem,
  coordinateOrigin,
  coordinateZoom
}) {
  const {viewMatrixUncentered} = viewport;
  let {viewMatrix} = viewport;
  const {projectionMatrix} = viewport;
  let {viewProjectionMatrix} = viewport;

  let projectionCenter;
  let cameraPosCommon = viewport.cameraPosition;
  let shaderCoordinateSystem = getShaderCoordinateSystem(coordinateSystem);
  let shaderCoordinateOrigin = coordinateOrigin;

  if (shaderCoordinateSystem === PROJECT_COORDINATE_SYSTEM.LNGLAT_AUTO_OFFSET) {
    if (coordinateZoom < LNGLAT_AUTO_OFFSET_ZOOM_THRESHOLD) {
      // Use LNG_LAT projection if not zooming
      shaderCoordinateSystem = PROJECT_COORDINATE_SYSTEM.LNG_LAT;
    } else {
      // Use LNGLAT_AUTO_OFFSET
      const lng = Math.fround(viewport.longitude);
      const lat = Math.fround(viewport.latitude);
      shaderCoordinateOrigin = [lng, lat];
    }
  }
  if (shaderCoordinateSystem === PROJECT_COORDINATE_SYSTEM.IDENTITY) {
    // We only support 64-bit precision in the X and Y components of positions for now
    shaderCoordinateOrigin = [Math.fround(viewport.position[0]), Math.fround(viewport.position[1])];
  }

  shaderCoordinateOrigin[2] = shaderCoordinateOrigin[2] || 0;

  switch (shaderCoordinateSystem) {
    case PROJECT_COORDINATE_SYSTEM.LNG_LAT:
      projectionCenter = ZERO_VECTOR;
      break;

    // TODO: make lighting work for meter offset mode
    case PROJECT_COORDINATE_SYSTEM.LNGLAT_OFFSETS:
    case PROJECT_COORDINATE_SYSTEM.METER_OFFSETS:
    case PROJECT_COORDINATE_SYSTEM.LNGLAT_AUTO_OFFSET:
    case PROJECT_COORDINATE_SYSTEM.IDENTITY:
      // Calculate transformed projectionCenter (using 64 bit precision JS)
      // This is the key to offset mode precision
      // (avoids doing this addition in 32 bit precision in GLSL)
      const positionCommonSpace = viewport.projectPosition(
        shaderCoordinateOrigin,
        Math.pow(2, coordinateZoom)
      );

      cameraPosCommon = [
        cameraPosCommon[0] - positionCommonSpace[0],
        cameraPosCommon[1] - positionCommonSpace[1],
        cameraPosCommon[2] - positionCommonSpace[2]
      ];

      positionCommonSpace[3] = 1;

      // projectionCenter = new Matrix4(viewProjectionMatrix)
      //   .transformVector([positionPixels[0], positionPixels[1], 0.0, 1.0]);
      projectionCenter = vec4.transformMat4([], positionCommonSpace, viewProjectionMatrix);

      // Always apply uncentered projection matrix if available (shader adds center)
      viewMatrix = viewMatrixUncentered || viewMatrix;

      // Zero out 4th coordinate ("after" model matrix) - avoids further translations
      // viewMatrix = new Matrix4(viewMatrixUncentered || viewMatrix)
      //   .multiplyRight(VECTOR_TO_POINT_MATRIX);
      viewProjectionMatrix = mat4.multiply([], projectionMatrix, viewMatrix);
      viewProjectionMatrix = mat4.multiply([], viewProjectionMatrix, VECTOR_TO_POINT_MATRIX);
      break;

    default:
      throw new Error('Unknown projection mode');
  }

  return {
    viewMatrix,
    viewProjectionMatrix,
    projectionCenter,
    cameraPosCommon,
    shaderCoordinateSystem,
    shaderCoordinateOrigin
  };
}

/**
 * Returns uniforms for shaders based on current projection
 * includes: projection matrix suitable for shaders
 *
 * TODO - Ensure this works with any viewport, not just WebMercatorViewports
 *
 * @param {WebMercatorViewport} viewport -
 * @return {Float32Array} - 4x4 projection matrix that can be used in shaders
 */
export function getUniformsFromViewport({
  viewport,
  devicePixelRatio = 1,
  modelMatrix = null,
  // Match Layer.defaultProps
  coordinateSystem = COORDINATE_SYSTEM.LNGLAT,
  coordinateOrigin = DEFAULT_COORDINATE_ORIGIN,
  wrapLongitude = false,
  // Deprecated
  projectionMode,
  positionOrigin
} = {}) {
  assert(viewport);

  return Object.assign(
    {
      project_uModelMatrix: modelMatrix || IDENTITY_MATRIX
    },
    getMemoizedViewportUniforms({
      viewport,
      devicePixelRatio,
      coordinateSystem,
      coordinateOrigin,
      wrapLongitude
    })
  );
}

function calculateViewportUniforms({
  viewport,
  devicePixelRatio,
  coordinateSystem,
  coordinateOrigin,
  wrapLongitude
}) {
  const coordinateZoom = viewport.zoom;

  const {
    projectionCenter,
    viewProjectionMatrix,
    cameraPosCommon,
    shaderCoordinateSystem,
    shaderCoordinateOrigin
  } = calculateMatrixAndOffset({
    coordinateSystem,
    coordinateOrigin,
    coordinateZoom,
    viewport
  });

  assert(viewProjectionMatrix, 'Viewport missing modelViewProjectionMatrix');

  // Calculate projection pixels per unit
  const distanceScales = viewport.getDistanceScales();

  const viewportSize = [viewport.width * devicePixelRatio, viewport.height * devicePixelRatio];

  const uniforms = {
    // Projection mode values
    project_uCoordinateSystem: shaderCoordinateSystem,
    project_uCenter: projectionCenter,
    project_uWrapLongitude: wrapLongitude,
    project_uAntimeridian: (viewport.longitude || 0) - 180,

    // Screen size
    project_uViewportSize: viewportSize,
    project_uDevicePixelRatio: devicePixelRatio,

    // Distance at which screen pixels are projected
    project_uFocalDistance: viewport.focalDistance || 1,
    project_uCommonUnitsPerMeter: distanceScales.pixelsPerMeter,
    project_uCommonUnitsPerWorldUnit: distanceScales.pixelsPerMeter,
    project_uCommonUnitsPerWorldUnit2: DEFAULT_PIXELS_PER_UNIT2,
    project_uScale: viewport.scale, // This is the mercator scale (2 ** zoom)

    project_uViewProjectionMatrix: viewProjectionMatrix,

    // This is for lighting calculations
    project_uCameraPosition: cameraPosCommon
  };

  const distanceScalesAtOrigin = viewport.getDistanceScales(shaderCoordinateOrigin);
  switch (shaderCoordinateSystem) {
    case PROJECT_COORDINATE_SYSTEM.METER_OFFSETS:
      uniforms.project_uCommonUnitsPerWorldUnit = distanceScalesAtOrigin.pixelsPerMeter;
      uniforms.project_uCommonUnitsPerWorldUnit2 = distanceScalesAtOrigin.pixelsPerMeter2;
      break;

    case PROJECT_COORDINATE_SYSTEM.LNGLAT_AUTO_OFFSET:
      uniforms.project_uCoordinateOrigin = shaderCoordinateOrigin;
    // eslint-disable-line no-fallthrough
    case PROJECT_COORDINATE_SYSTEM.LNG_LAT:
    case PROJECT_COORDINATE_SYSTEM.LNGLAT_OFFSETS:
      uniforms.project_uCommonUnitsPerWorldUnit = distanceScalesAtOrigin.pixelsPerDegree;
      uniforms.project_uCommonUnitsPerWorldUnit2 = distanceScalesAtOrigin.pixelsPerDegree2;
      break;

    case PROJECT_COORDINATE_SYSTEM.IDENTITY:
      uniforms.project_uCoordinateOrigin = shaderCoordinateOrigin;
      break;

    default:
      break;
  }

  return uniforms;
}

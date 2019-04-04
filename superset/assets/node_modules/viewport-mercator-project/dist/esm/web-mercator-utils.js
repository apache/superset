import _slicedToArray from "@babel/runtime/helpers/esm/slicedToArray";
import { createMat4, transformVector } from './math-utils';
import * as mat4 from 'gl-matrix/mat4';
import * as vec2 from 'gl-matrix/vec2';
import * as vec3 from 'gl-matrix/vec3';
import assert from './assert';
var PI = Math.PI;
var PI_4 = PI / 4;
var DEGREES_TO_RADIANS = PI / 180;
var RADIANS_TO_DEGREES = 180 / PI;
var TILE_SIZE = 512;
var EARTH_CIRCUMFERENCE = 40.03e6;
var DEFAULT_ALTITUDE = 1.5;
export function zoomToScale(zoom) {
  return Math.pow(2, zoom);
}
export function scaleToZoom(scale) {
  return Math.log2(scale);
}
export function lngLatToWorld(_ref, scale) {
  var _ref2 = _slicedToArray(_ref, 2),
      lng = _ref2[0],
      lat = _ref2[1];

  assert(Number.isFinite(lng) && Number.isFinite(scale));
  assert(Number.isFinite(lat) && lat >= -90 && lat <= 90, 'invalid latitude');
  scale *= TILE_SIZE;
  var lambda2 = lng * DEGREES_TO_RADIANS;
  var phi2 = lat * DEGREES_TO_RADIANS;
  var x = scale * (lambda2 + PI) / (2 * PI);
  var y = scale * (PI - Math.log(Math.tan(PI_4 + phi2 * 0.5))) / (2 * PI);
  return [x, y];
}
export function worldToLngLat(_ref3, scale) {
  var _ref4 = _slicedToArray(_ref3, 2),
      x = _ref4[0],
      y = _ref4[1];

  scale *= TILE_SIZE;
  var lambda2 = x / scale * (2 * PI) - PI;
  var phi2 = 2 * (Math.atan(Math.exp(PI - y / scale * (2 * PI))) - PI_4);
  return [lambda2 * RADIANS_TO_DEGREES, phi2 * RADIANS_TO_DEGREES];
}
export function getMeterZoom(_ref5) {
  var latitude = _ref5.latitude;
  assert(Number.isFinite(latitude));
  var latCosine = Math.cos(latitude * DEGREES_TO_RADIANS);
  return scaleToZoom(EARTH_CIRCUMFERENCE * latCosine) - 9;
}
export function getDistanceScales(_ref6) {
  var latitude = _ref6.latitude,
      longitude = _ref6.longitude,
      zoom = _ref6.zoom,
      scale = _ref6.scale,
      _ref6$highPrecision = _ref6.highPrecision,
      highPrecision = _ref6$highPrecision === void 0 ? false : _ref6$highPrecision;
  scale = scale !== undefined ? scale : zoomToScale(zoom);
  assert(Number.isFinite(latitude) && Number.isFinite(longitude) && Number.isFinite(scale));
  var result = {};
  var worldSize = TILE_SIZE * scale;
  var latCosine = Math.cos(latitude * DEGREES_TO_RADIANS);
  var pixelsPerDegreeX = worldSize / 360;
  var pixelsPerDegreeY = pixelsPerDegreeX / latCosine;
  var altPixelsPerMeter = worldSize / EARTH_CIRCUMFERENCE / latCosine;
  result.pixelsPerMeter = [altPixelsPerMeter, -altPixelsPerMeter, altPixelsPerMeter];
  result.metersPerPixel = [1 / altPixelsPerMeter, -1 / altPixelsPerMeter, 1 / altPixelsPerMeter];
  result.pixelsPerDegree = [pixelsPerDegreeX, -pixelsPerDegreeY, altPixelsPerMeter];
  result.degreesPerPixel = [1 / pixelsPerDegreeX, -1 / pixelsPerDegreeY, 1 / altPixelsPerMeter];

  if (highPrecision) {
    var latCosine2 = DEGREES_TO_RADIANS * Math.tan(latitude * DEGREES_TO_RADIANS) / latCosine;
    var pixelsPerDegreeY2 = pixelsPerDegreeX * latCosine2 / 2;
    var altPixelsPerDegree2 = worldSize / EARTH_CIRCUMFERENCE * latCosine2;
    var altPixelsPerMeter2 = altPixelsPerDegree2 / pixelsPerDegreeY * altPixelsPerMeter;
    result.pixelsPerDegree2 = [0, -pixelsPerDegreeY2, altPixelsPerDegree2];
    result.pixelsPerMeter2 = [altPixelsPerMeter2, 0, altPixelsPerMeter2];
  }

  return result;
}
export function addMetersToLngLat(lngLatZ, xyz) {
  var _lngLatZ = _slicedToArray(lngLatZ, 3),
      longitude = _lngLatZ[0],
      latitude = _lngLatZ[1],
      z0 = _lngLatZ[2];

  var _xyz = _slicedToArray(xyz, 3),
      x = _xyz[0],
      y = _xyz[1],
      z = _xyz[2];

  var scale = 1;

  var _getDistanceScales = getDistanceScales({
    longitude: longitude,
    latitude: latitude,
    scale: scale,
    highPrecision: true
  }),
      pixelsPerMeter = _getDistanceScales.pixelsPerMeter,
      pixelsPerMeter2 = _getDistanceScales.pixelsPerMeter2;

  var worldspace = lngLatToWorld(lngLatZ, scale);
  worldspace[0] += x * (pixelsPerMeter[0] + pixelsPerMeter2[0] * y);
  worldspace[1] += y * (pixelsPerMeter[1] + pixelsPerMeter2[1] * y);
  var newLngLat = worldToLngLat(worldspace, scale);
  var newZ = (z0 || 0) + (z || 0);
  return Number.isFinite(z0) || Number.isFinite(z) ? [newLngLat[0], newLngLat[1], newZ] : newLngLat;
}
export function getViewMatrix(_ref7) {
  var height = _ref7.height,
      pitch = _ref7.pitch,
      bearing = _ref7.bearing,
      altitude = _ref7.altitude,
      _ref7$center = _ref7.center,
      center = _ref7$center === void 0 ? null : _ref7$center,
      _ref7$flipY = _ref7.flipY,
      flipY = _ref7$flipY === void 0 ? false : _ref7$flipY;
  var vm = createMat4();
  mat4.translate(vm, vm, [0, 0, -altitude]);
  mat4.scale(vm, vm, [1, 1, 1 / height]);
  mat4.rotateX(vm, vm, -pitch * DEGREES_TO_RADIANS);
  mat4.rotateZ(vm, vm, bearing * DEGREES_TO_RADIANS);

  if (flipY) {
    mat4.scale(vm, vm, [1, -1, 1]);
  }

  if (center) {
    mat4.translate(vm, vm, vec3.negate([], center));
  }

  return vm;
}
export function getProjectionParameters(_ref8) {
  var width = _ref8.width,
      height = _ref8.height,
      _ref8$altitude = _ref8.altitude,
      altitude = _ref8$altitude === void 0 ? DEFAULT_ALTITUDE : _ref8$altitude,
      _ref8$pitch = _ref8.pitch,
      pitch = _ref8$pitch === void 0 ? 0 : _ref8$pitch,
      _ref8$nearZMultiplier = _ref8.nearZMultiplier,
      nearZMultiplier = _ref8$nearZMultiplier === void 0 ? 1 : _ref8$nearZMultiplier,
      _ref8$farZMultiplier = _ref8.farZMultiplier,
      farZMultiplier = _ref8$farZMultiplier === void 0 ? 1 : _ref8$farZMultiplier;
  var pitchRadians = pitch * DEGREES_TO_RADIANS;
  var halfFov = Math.atan(0.5 / altitude);
  var topHalfSurfaceDistance = Math.sin(halfFov) * altitude / Math.sin(Math.PI / 2 - pitchRadians - halfFov);
  var farZ = Math.cos(Math.PI / 2 - pitchRadians) * topHalfSurfaceDistance + altitude;
  return {
    fov: 2 * Math.atan(height / 2 / altitude),
    aspect: width / height,
    focalDistance: altitude,
    near: nearZMultiplier,
    far: farZ * farZMultiplier
  };
}
export function getProjectionMatrix(_ref9) {
  var width = _ref9.width,
      height = _ref9.height,
      pitch = _ref9.pitch,
      altitude = _ref9.altitude,
      nearZMultiplier = _ref9.nearZMultiplier,
      farZMultiplier = _ref9.farZMultiplier;

  var _getProjectionParamet = getProjectionParameters({
    width: width,
    height: height,
    altitude: altitude,
    pitch: pitch,
    nearZMultiplier: nearZMultiplier,
    farZMultiplier: farZMultiplier
  }),
      fov = _getProjectionParamet.fov,
      aspect = _getProjectionParamet.aspect,
      near = _getProjectionParamet.near,
      far = _getProjectionParamet.far;

  var projectionMatrix = mat4.perspective([], fov, aspect, near, far);
  return projectionMatrix;
}
export function worldToPixels(xyz, pixelProjectionMatrix) {
  var _xyz2 = _slicedToArray(xyz, 3),
      x = _xyz2[0],
      y = _xyz2[1],
      _xyz2$ = _xyz2[2],
      z = _xyz2$ === void 0 ? 0 : _xyz2$;

  assert(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z));
  return transformVector(pixelProjectionMatrix, [x, y, z, 1]);
}
export function pixelsToWorld(xyz, pixelUnprojectionMatrix) {
  var targetZ = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;

  var _xyz3 = _slicedToArray(xyz, 3),
      x = _xyz3[0],
      y = _xyz3[1],
      z = _xyz3[2];

  assert(Number.isFinite(x) && Number.isFinite(y), 'invalid pixel coordinate');

  if (Number.isFinite(z)) {
    var coord = transformVector(pixelUnprojectionMatrix, [x, y, z, 1]);
    return coord;
  }

  var coord0 = transformVector(pixelUnprojectionMatrix, [x, y, 0, 1]);
  var coord1 = transformVector(pixelUnprojectionMatrix, [x, y, 1, 1]);
  var z0 = coord0[2];
  var z1 = coord1[2];
  var t = z0 === z1 ? 0 : ((targetZ || 0) - z0) / (z1 - z0);
  return vec2.lerp([], coord0, coord1, t);
}
//# sourceMappingURL=web-mercator-utils.js.map
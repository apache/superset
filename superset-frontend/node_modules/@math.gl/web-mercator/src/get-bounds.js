import {worldToLngLat} from './web-mercator-utils';
import * as vec2 from 'gl-matrix/vec2';
import {transformVector} from './math-utils';

const DEGREES_TO_RADIANS = Math.PI / 180;

/*
 * Returns the quad at the intersection of the frustum and the given z plane
 * @param {WebMercatorViewport} viewport
 * @param {Number} z - elevation in meters
 */
export default function getBounds(viewport, z = 0) {
  const {width, height, unproject} = viewport;
  const unprojectOps = {targetZ: z};
  const bottomLeft = unproject([0, height], unprojectOps);
  const bottomRight = unproject([width, height], unprojectOps);
  let topLeft;
  let topRight;

  const halfFov = Math.atan(0.5 / viewport.altitude);
  const angleToGround = (90 - viewport.pitch) * DEGREES_TO_RADIANS;
  // The top plane is parallel to the ground if halfFov == angleToGround
  if (halfFov > angleToGround - 0.01) {
    // intersect with the far plane
    topLeft = unprojectOnFarPlane(viewport, 0, z);
    topRight = unprojectOnFarPlane(viewport, width, z);
  } else {
    // intersect with the top plane
    topLeft = unproject([0, 0], unprojectOps);
    topRight = unproject([width, 0], unprojectOps);
  }

  return [bottomLeft, bottomRight, topRight, topLeft];
}

/*
 * Find a point on the far clipping plane of the viewport
 * @param {WebMercatorViewport} viewport
 * @param {Number} x - projected x in screen space
 * @param {Number} targetZ - the elevation of the point in meters
 */
function unprojectOnFarPlane(viewport, x, targetZ) {
  const {pixelUnprojectionMatrix} = viewport;
  const coord0 = transformVector(pixelUnprojectionMatrix, [x, 0, 1, 1]);
  const coord1 = transformVector(pixelUnprojectionMatrix, [x, viewport.height, 1, 1]);

  const z = targetZ * viewport.distanceScales.unitsPerMeter[2];
  const t = (z - coord0[2]) / (coord1[2] - coord0[2]);
  const coord = vec2.lerp([], coord0, coord1, t);

  const result = worldToLngLat(coord);
  result[2] = targetZ;
  return result;
}

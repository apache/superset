/**
 * Projection utils
 * TODO: move to Viewport class?
 */
import {COORDINATE_SYSTEM} from '../../lib/constants';
import vec4_transformMat4 from 'gl-vec4/transformMat4';
import vec3_sub from 'gl-vec3/subtract';

function lngLatZToWorldPosition(lngLatZ, viewport) {
  const [X, Y] = viewport.projectFlat(lngLatZ);
  const Z = (lngLatZ[2] || 0) * viewport.distanceScales.pixelsPerMeter[2];
  return [X, Y, Z];
}

/**
 * Equivalent to project_position in project.glsl
 * projects a user supplied position to world position in the target coordinates system
 * @param {array} position - [x, y, z]
 * @param {object} params
 * @param {Viewport} params.viewport - the current viewport
 * @param {number} params.coordinateSystem - the coordinate system to project into
 * @param {array} params.coordinateOrigin - the coordinate origin to project into
 * @param {Matrix4} [params.modelMatrix] - the model matrix of the supplied position
 * @param {number} [params.fromCoordinateSystem] - the coordinate system that the
 *   supplied position is in. Default to the same as `coordinateSystem`.
 * @param {array} [params.fromCoordinateOrigin] - the coordinate origin that the
 *   supplied position is in. Default to the same as `coordinateOrigin`.
 */
export function projectPosition(
  position,
  {
    // required
    viewport,
    coordinateSystem,
    coordinateOrigin,
    // optional
    modelMatrix,
    fromCoordinateSystem,
    fromCoordinateOrigin
  }
) {
  let [x, y, z] = position;
  let worldPosition;

  if (modelMatrix) {
    [x, y, z] = vec4_transformMat4([], [x, y, z, 1.0], modelMatrix);
  }
  if (fromCoordinateSystem === undefined) {
    fromCoordinateSystem = coordinateSystem;
  }
  if (fromCoordinateOrigin === undefined) {
    fromCoordinateOrigin = coordinateOrigin;
  }

  // pre-project light coordinates
  switch (fromCoordinateSystem) {
    case COORDINATE_SYSTEM.LNGLAT:
      worldPosition = lngLatZToWorldPosition([x, y, z], viewport);
      break;

    case COORDINATE_SYSTEM.LNGLAT_OFFSETS:
      worldPosition = lngLatZToWorldPosition(
        [
          x + fromCoordinateOrigin[0],
          y + fromCoordinateOrigin[1],
          z + (fromCoordinateOrigin[2] || 0)
        ],
        viewport
      );
      break;

    case COORDINATE_SYSTEM.METER_OFFSETS:
      worldPosition = lngLatZToWorldPosition(
        viewport.addMetersToLngLat(fromCoordinateOrigin, [x, y, z]),
        viewport
      );
      break;

    default:
      worldPosition = [x, y, z];
  }

  switch (coordinateSystem) {
    case COORDINATE_SYSTEM.LNGLAT_OFFSETS:
    case COORDINATE_SYSTEM.METER_OFFSETS:
      const originWorld = lngLatZToWorldPosition(coordinateOrigin, viewport);
      vec3_sub(worldPosition, worldPosition, originWorld);
      worldPosition[1] = -worldPosition[1];
      break;

    default:
  }

  return worldPosition;
}

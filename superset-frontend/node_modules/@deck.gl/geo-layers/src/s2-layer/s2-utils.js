// s2-geometry is a pure JavaScript port of Google/Niantic's S2 Geometry library
// which is perfect since it works in the browser.
import {S2} from 's2-geometry';
import Long from 'long';

/**
 * Given an S2 token this function convert the token to 64 bit id
   https://github.com/google/s2-geometry-library-java/blob/c04b68bf3197a9c34082327eeb3aec7ab7c85da1/src/com/google/common/geometry/S2CellId.java#L439
 * */
function getIdFromToken(token) {
  // pad token with zeros to make the length 16
  const paddedToken = token.padEnd(16, '0');
  return Long.fromString(paddedToken, 16);
}

const RADIAN_TO_DEGREE = 180 / Math.PI;
const MAX_RESOLUTION = 100;

/* Adapted from s2-geometry's S2.XYZToLatLng */
function XYZToLngLat([x, y, z]) {
  const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
  const lng = Math.atan2(y, x);

  return [lng * RADIAN_TO_DEGREE, lat * RADIAN_TO_DEGREE];
}

/* Adapted from s2-geometry's S2Cell.getCornerLatLngs */
function getGeoBounds({face, ij, level}) {
  const result = [];
  const offsets = [[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]];

  // The S2 cell edge is curved: http://s2geometry.io/
  // This is more prominent at lower levels
  // resolution is the number of segments to generate per edge.
  // We exponentially reduce resolution as level increases so it doesn't affect perf
  // when there are a large number of cells
  const resolution = Math.max(1, MAX_RESOLUTION * Math.pow(2, -level));

  for (let i = 0; i < 4; i++) {
    const offset = offsets[i].slice(0);
    const nextOffset = offsets[i + 1];
    const stepI = (nextOffset[0] - offset[0]) / resolution;
    const stepJ = (nextOffset[1] - offset[1]) / resolution;

    for (let j = 0; j < resolution; j++) {
      offset[0] += stepI;
      offset[1] += stepJ;
      // Cell can be represented by coordinates IJ, ST, UV, XYZ
      // http://s2geometry.io/devguide/s2cell_hierarchy#coordinate-systems
      const st = S2.IJToST(ij, level, offset);
      const uv = S2.STToUV(st);
      const xyz = S2.FaceUVToXYZ(face, uv);

      result.push(XYZToLngLat(xyz));
    }
  }
  return result;
}

export function getS2QuadKey(token) {
  if (typeof token === 'string') {
    if (token.indexOf('/') > 0) {
      // is Hilbert quad key
      return token;
    }
    // is S2 token
    token = getIdFromToken(token);
  }
  // is Long id
  return S2.S2Cell.toHilbertQuadkey(token.toString());
}

/**
 * Get a polygon with corner coordinates for an s2 cell
 * @param {*} cell - This can be an S2 key or token
 * @return {Array} - a simple polygon in array format: [[lng, lat], ...]
 *   - each coordinate is an array [lng, lat]
 *   - the polygon is closed, i.e. last coordinate is a copy of the first coordinate
 */
export function getS2Polygon(token) {
  const key = getS2QuadKey(token);
  const s2cell = S2.S2Cell.FromHilbertQuadKey(key);

  return getGeoBounds(s2cell);
}

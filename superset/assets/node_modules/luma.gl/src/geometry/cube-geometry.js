import Geometry from './geometry';
import {uid} from '../utils';

export default class CubeGeometry extends Geometry {
  constructor(opts = {}) {
    const {id = uid('cube-geometry')} = opts;
    super(Object.assign({}, opts, {id, attributes: getCubeAttributes()}));
  }
}

/* eslint-disable no-multi-spaces, indent */
const CUBE_INDICES = new Uint16Array([
  0, 1, 2, 0, 2, 3,
  4, 5, 6, 4, 6, 7,
  8, 9, 10, 8, 10, 11,
  12, 13, 14, 12, 14, 15,
  16, 17, 18, 16, 18, 19,
  20, 21, 22, 20, 22, 23
]);

const CUBE_POSITIONS = new Float32Array([
  -1, -1,  1,
   1, -1,  1,
   1,  1,  1,
  -1,  1,  1,

  -1, -1, -1,
  -1,  1, -1,
   1,  1, -1,
   1, -1, -1,

  -1,  1, -1,
  -1,  1,  1,
   1,  1,  1,
   1,  1, -1,

  -1, -1, -1,
   1, -1, -1,
   1, -1,  1,
  -1, -1,  1,

   1, -1, -1,
   1,  1, -1,
   1,  1,  1,
   1, -1,  1,

  -1, -1, -1,
  -1, -1,  1,
  -1,  1,  1,
  -1,  1, -1
]);

const CUBE_NORMALS = new Float32Array([
  // Front face
  0.0,  0.0,  1.0,
  0.0,  0.0,  1.0,
  0.0,  0.0,  1.0,
  0.0,  0.0,  1.0,

  // Back face
  0.0,  0.0, -1.0,
  0.0,  0.0, -1.0,
  0.0,  0.0, -1.0,
  0.0,  0.0, -1.0,

  // Top face
  0.0,  1.0,  0.0,
  0.0,  1.0,  0.0,
  0.0,  1.0,  0.0,
  0.0,  1.0,  0.0,

  // Bottom face
  0.0, -1.0,  0.0,
  0.0, -1.0,  0.0,
  0.0, -1.0,  0.0,
  0.0, -1.0,  0.0,

  // Right face
  1.0,  0.0,  0.0,
  1.0,  0.0,  0.0,
  1.0,  0.0,  0.0,
  1.0,  0.0,  0.0,

  // Left face
  -1.0,  0.0,  0.0,
  -1.0,  0.0,  0.0,
  -1.0,  0.0,  0.0,
  -1.0,  0.0,  0.0
]);

const CUBE_TEX_COORDS = new Float32Array([
  // Front face
  0.0, 0.0,
  1.0, 0.0,
  1.0, 1.0,
  0.0, 1.0,

  // Back face
  1.0, 0.0,
  1.0, 1.0,
  0.0, 1.0,
  0.0, 0.0,

  // Top face
  0.0, 1.0,
  0.0, 0.0,
  1.0, 0.0,
  1.0, 1.0,

  // Bottom face
  1.0, 1.0,
  0.0, 1.0,
  0.0, 0.0,
  1.0, 0.0,

  // Right face
  1.0, 0.0,
  1.0, 1.0,
  0.0, 1.0,
  0.0, 0.0,

  // Left face
  0.0, 0.0,
  1.0, 0.0,
  1.0, 1.0,
  0.0, 1.0
]);
/* eslint-enable no-multi-spaces, indent */

function getCubeAttributes() {
  return {
    indices: new Uint16Array(CUBE_INDICES),
    positions: new Float32Array(CUBE_POSITIONS),
    normals: new Float32Array(CUBE_NORMALS),
    texCoords: new Float32Array(CUBE_TEX_COORDS)
  };
}

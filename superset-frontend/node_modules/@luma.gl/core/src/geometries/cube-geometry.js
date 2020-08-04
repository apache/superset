import Geometry from '../geometry/geometry';
import {uid} from '../utils';

// prettier-ignore
const CUBE_INDICES = new Uint16Array([
  0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13,
  14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23
]);

// prettier-ignore
const CUBE_POSITIONS = new Float32Array([
  -1,  -1,  1, 1,  -1,  1,  1,  1,  1,  -1,  1,  1,
  -1,  -1,  -1,  -1,  1,  -1,  1,  1,  -1,  1,  -1,  -1,
  -1,  1,  -1,  -1,  1,  1,  1,  1,  1,  1,  1,  -1,
  -1,  -1,  -1,  1,  -1,  -1,  1,  -1,  1,  -1,  -1,  1,
  1,  -1,  -1,  1,  1,  -1,  1,  1,  1,  1,  -1,  1,
  -1,  -1,  -1,  -1,  -1,  1,  -1,  1,  1,  -1,  1,  -1
]);

// TODO - could be Uint8
// prettier-ignore
const CUBE_NORMALS = new Float32Array([
  // Front face
  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,
  // Back face
  0,  0,  -1,  0,  0,  -1,  0,  0,  -1,  0,  0,  -1,
  // Top face
  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,
  // Bottom face
  0,  -1,  0,  0,  -1,  0,  0,  -1,  0,  0,  -1,  0,
  // Right face
  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,
  // Left face
  -1,  0,  0,  -1,  0,  0,  -1,  0,  0,  -1,  0,  0
]);

// prettier-ignore
const CUBE_TEX_COORDS = new Float32Array([
  // Front face
  0,  0,  1,  0,  1,  1,  0,  1,
  // Back face
  1,  0,  1,  1,  0,  1,  0,  0,
  // Top face
  0,  1,  0,  0,  1,  0,  1,  1,
  // Bottom face
  1,  1,  0,  1,  0,  0,  1,  0,
  // Right face
  1,  0,  1,  1,  0,  1,  0,  0,
  // Left face
  0,  0,  1,  0,  1,  1,  0,  1
]);

const ATTRIBUTES = {
  POSITION: {size: 3, value: new Float32Array(CUBE_POSITIONS)},
  NORMAL: {size: 3, value: new Float32Array(CUBE_NORMALS)},
  TEXCOORD_0: {size: 2, value: new Float32Array(CUBE_TEX_COORDS)}
};

export default class CubeGeometry extends Geometry {
  constructor(props = {}) {
    const {id = uid('cube-geometry')} = props;
    super({
      ...props,
      id,
      indices: {size: 1, value: new Uint16Array(CUBE_INDICES)},
      attributes: {...ATTRIBUTES, ...props.attributes}
    });
  }
}

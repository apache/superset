import Geometry from '../geometry/geometry';
import {unpackIndexedGeometry} from '../geometry/geometry-utils';
import {uid} from '../utils';

export default class PlaneGeometry extends Geometry {
  constructor(props = {}) {
    const {id = uid('plane-geometry')} = props;

    const {indices, attributes} = tesselatePlane(props);
    super({
      ...props,
      id,
      indices,
      attributes: {...attributes, ...props.attributes}
    });
  }
}

// Primitives inspired by TDL http://code.google.com/p/webglsamples/,
// copyright 2011 Google Inc. new BSD License
// (http://www.opensource.org/licenses/bsd-license.php).
/* eslint-disable max-statements, complexity */
/* eslint-disable complexity, max-statements */
function tesselatePlane(props) {
  const {type = 'x,y', offset = 0, flipCull = false, unpack = false} = props;

  const coords = type.split(',');
  // width, height
  let c1len = props[`${coords[0]}len`] || 1;
  const c2len = props[`${coords[1]}len`] || 1;
  // subdivisionsWidth, subdivisionsDepth
  const subdivisions1 = props[`n${coords[0]}`] || 1;
  const subdivisions2 = props[`n${coords[1]}`] || 1;
  const numVertices = (subdivisions1 + 1) * (subdivisions2 + 1);

  const positions = new Float32Array(numVertices * 3);
  const normals = new Float32Array(numVertices * 3);
  const texCoords = new Float32Array(numVertices * 2);

  if (flipCull) {
    c1len = -c1len;
  }

  let i2 = 0;
  let i3 = 0;
  for (let z = 0; z <= subdivisions2; z++) {
    for (let x = 0; x <= subdivisions1; x++) {
      const u = x / subdivisions1;
      const v = z / subdivisions2;
      texCoords[i2 + 0] = flipCull ? 1 - u : u;
      texCoords[i2 + 1] = v;

      switch (type) {
        case 'x,y':
          positions[i3 + 0] = c1len * u - c1len * 0.5;
          positions[i3 + 1] = c2len * v - c2len * 0.5;
          positions[i3 + 2] = offset;

          normals[i3 + 0] = 0;
          normals[i3 + 1] = 0;
          normals[i3 + 2] = flipCull ? 1 : -1;
          break;

        case 'x,z':
          positions[i3 + 0] = c1len * u - c1len * 0.5;
          positions[i3 + 1] = offset;
          positions[i3 + 2] = c2len * v - c2len * 0.5;

          normals[i3 + 0] = 0;
          normals[i3 + 1] = flipCull ? 1 : -1;
          normals[i3 + 2] = 0;
          break;

        case 'y,z':
          positions[i3 + 0] = offset;
          positions[i3 + 1] = c1len * u - c1len * 0.5;
          positions[i3 + 2] = c2len * v - c2len * 0.5;

          normals[i3 + 0] = flipCull ? 1 : -1;
          normals[i3 + 1] = 0;
          normals[i3 + 2] = 0;
          break;

        default:
          throw new Error('PlaneGeometry: unknown type');
      }

      i2 += 2;
      i3 += 3;
    }
  }

  const numVertsAcross = subdivisions1 + 1;
  const indices = new Uint16Array(subdivisions1 * subdivisions2 * 6);

  for (let z = 0; z < subdivisions2; z++) {
    for (let x = 0; x < subdivisions1; x++) {
      const index = (z * subdivisions1 + x) * 6;
      // Make triangle 1 of quad.
      indices[index + 0] = (z + 0) * numVertsAcross + x;
      indices[index + 1] = (z + 1) * numVertsAcross + x;
      indices[index + 2] = (z + 0) * numVertsAcross + x + 1;

      // Make triangle 2 of quad.
      indices[index + 3] = (z + 1) * numVertsAcross + x;
      indices[index + 4] = (z + 1) * numVertsAcross + x + 1;
      indices[index + 5] = (z + 0) * numVertsAcross + x + 1;
    }
  }

  const geometry = {
    indices: {size: 1, value: indices},
    attributes: {
      POSITION: {size: 3, value: positions},
      NORMAL: {size: 3, value: normals},
      TEXCOORD_0: {size: 2, value: texCoords}
    }
  };

  // Optionally, unpack indexed geometry
  return unpack ? unpackIndexedGeometry(geometry) : geometry;
}

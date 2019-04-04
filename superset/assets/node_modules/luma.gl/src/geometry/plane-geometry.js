import Geometry from './geometry';
import {uid} from '../utils';

export default class PlaneGeometry extends Geometry {

  // Primitives inspired by TDL http://code.google.com/p/webglsamples/,
  // copyright 2011 Google Inc. new BSD License
  // (http://www.opensource.org/licenses/bsd-license.php).
  /* eslint-disable max-statements, complexity */
  /* eslint-disable complexity, max-statements */
  constructor(opts = {}) {
    const {
      type = 'x,y',
      offset = 0,
      flipCull = false,
      unpack = false,
      id = uid('plane-geometry')
    } = opts;

    const coords = type.split(',');
    // width, height
    let c1len = opts[`${coords[0]}len`];
    const c2len = opts[`${coords[1]}len`];
    // subdivisionsWidth, subdivisionsDepth
    const subdivisions1 = opts[`n${coords[0]}`] || 1;
    const subdivisions2 = opts[`n${coords[1]}`] || 1;
    const numVertices = (subdivisions1 + 1) * (subdivisions2 + 1);

    let positions = new Float32Array(numVertices * 3);
    let normals = new Float32Array(numVertices * 3);
    let texCoords = new Float32Array(numVertices * 2);

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
          break;
        }

        i2 += 2;
        i3 += 3;
      }
    }

    const numVertsAcross = subdivisions1 + 1;
    let indices = new Uint16Array(subdivisions1 * subdivisions2 * 6);

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

    // Optionally, unpack indexed geometry
    if (unpack) {
      const positions2 = new Float32Array(indices.length * 3);
      const normals2 = new Float32Array(indices.length * 3);
      const texCoords2 = new Float32Array(indices.length * 2);

      for (let x = 0; x < indices.length; ++x) {
        const index = indices[x];
        positions2[x * 3 + 0] = positions[index * 3 + 0];
        positions2[x * 3 + 1] = positions[index * 3 + 1];
        positions2[x * 3 + 2] = positions[index * 3 + 2];
        normals2[x * 3 + 0] = normals[index * 3 + 0];
        normals2[x * 3 + 1] = normals[index * 3 + 1];
        normals2[x * 3 + 2] = normals[index * 3 + 2];
        texCoords2[x * 2 + 0] = texCoords[index * 2 + 0];
        texCoords2[x * 2 + 1] = texCoords[index * 2 + 1];
      }

      positions = positions2;
      normals = normals2;
      texCoords = texCoords2;
      indices = undefined;
    }

    const attributes = {
      positions,
      normals,
      texCoords
    };

    if (indices) {
      attributes.indices = indices;
    }

    super(Object.assign({}, opts, {attributes, id}));
  }
}

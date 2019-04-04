import Geometry from './geometry';
import {uid} from '../utils';

export default class SphereGeometry extends Geometry {
  constructor(opts = {}) {
    const {
      nlat = 10,
      nlong = 10,
      radius = 1,
      id = uid('sphere-geometry')
    } = opts;

    super(Object.assign({}, opts, {id, attributes: getSphereAttributes(nlat, nlong, radius)}));
  }
}

// Primitives inspired by TDL http://code.google.com/p/webglsamples/,
// copyright 2011 Google Inc. new BSD License
// (http://www.opensource.org/licenses/bsd-license.php).
/* eslint-disable max-statements, complexity */
function getSphereAttributes(nlat, nlong, radius) {
  const startLat = 0;
  const endLat = Math.PI;
  const latRange = endLat - startLat;
  const startLong = 0;
  const endLong = 2 * Math.PI;
  const longRange = endLong - startLong;
  const numVertices = (nlat + 1) * (nlong + 1);

  if (typeof radius === 'number') {
    const value = radius;
    radius = (n1, n2, n3, u, v) => value;
  }

  const positions = new Float32Array(numVertices * 3);
  const normals = new Float32Array(numVertices * 3);
  const texCoords = new Float32Array(numVertices * 2);
  const indices = new Uint16Array(nlat * nlong * 6);

  // Create positions, normals and texCoords
  for (let y = 0; y <= nlat; y++) {
    for (let x = 0; x <= nlong; x++) {

      const u = x / nlong;
      const v = y / nlat;

      const index = x + y * (nlong + 1);
      const i2 = index * 2;
      const i3 = index * 3;

      const theta = longRange * u;
      const phi = latRange * v;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      const ux = cosTheta * sinPhi;
      const uy = cosPhi;
      const uz = sinTheta * sinPhi;

      const r = radius(ux, uy, uz, u, v);

      positions[i3 + 0] = r * ux;
      positions[i3 + 1] = r * uy;
      positions[i3 + 2] = r * uz;

      normals[i3 + 0] = ux;
      normals[i3 + 1] = uy;
      normals[i3 + 2] = uz;

      texCoords[i2 + 0] = u;
      texCoords[i2 + 1] = v;
    }
  }

  // Create indices
  const numVertsAround = nlat + 1;
  for (let x = 0; x < nlat; x++) {
    for (let y = 0; y < nlong; y++) {
      const index = (x * nlong + y) * 6;

      indices[index + 0] = y * numVertsAround + x;
      indices[index + 1] = y * numVertsAround + x + 1;
      indices[index + 2] = (y + 1) * numVertsAround + x;

      indices[index + 3] = (y + 1) * numVertsAround + x;
      indices[index + 4] = y * numVertsAround + x + 1;
      indices[index + 5] = (y + 1) * numVertsAround + x + 1;
    }
  }

  return {
    positions,
    indices,
    normals,
    texCoords
  };
}

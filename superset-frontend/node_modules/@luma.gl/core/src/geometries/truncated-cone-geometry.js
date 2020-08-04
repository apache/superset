import Geometry from '../geometry/geometry';
import {uid} from '../utils';

const INDEX_OFFSETS = {
  x: [2, 0, 1],
  y: [0, 1, 2],
  z: [1, 2, 0]
};

export default class TruncatedConeGeometry extends Geometry {
  constructor(props = {}) {
    const {id = uid('truncated-code-geometry')} = props;
    const {indices, attributes} = tesselateTruncatedCone(props);
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
function tesselateTruncatedCone(props) {
  const {
    bottomRadius = 0,
    topRadius = 0,
    height = 1,
    nradial = 10,
    nvertical = 10,
    verticalAxis = 'y',
    topCap = false,
    bottomCap = false
  } = props;

  const extra = (topCap ? 2 : 0) + (bottomCap ? 2 : 0);
  const numVertices = (nradial + 1) * (nvertical + 1 + extra);

  const slant = Math.atan2(bottomRadius - topRadius, height);
  const msin = Math.sin;
  const mcos = Math.cos;
  const mpi = Math.PI;
  const cosSlant = mcos(slant);
  const sinSlant = msin(slant);
  const start = topCap ? -2 : 0;
  const end = nvertical + (bottomCap ? 2 : 0);
  const vertsAroundEdge = nradial + 1;

  const indices = new Uint16Array(nradial * (nvertical + extra) * 6);
  const indexOffset = INDEX_OFFSETS[verticalAxis];

  const positions = new Float32Array(numVertices * 3);
  const normals = new Float32Array(numVertices * 3);
  const texCoords = new Float32Array(numVertices * 2);

  let i3 = 0;
  let i2 = 0;
  for (let i = start; i <= end; i++) {
    let v = i / nvertical;
    let y = height * v;
    let ringRadius;

    if (i < 0) {
      y = 0;
      v = 1;
      ringRadius = bottomRadius;
    } else if (i > nvertical) {
      y = height;
      v = 1;
      ringRadius = topRadius;
    } else {
      ringRadius = bottomRadius + (topRadius - bottomRadius) * (i / nvertical);
    }
    if (i === -2 || i === nvertical + 2) {
      ringRadius = 0;
      v = 0;
    }
    y -= height / 2;
    for (let j = 0; j < vertsAroundEdge; j++) {
      const sin = msin((j * mpi * 2) / nradial);
      const cos = mcos((j * mpi * 2) / nradial);

      positions[i3 + indexOffset[0]] = sin * ringRadius;
      positions[i3 + indexOffset[1]] = y;
      positions[i3 + indexOffset[2]] = cos * ringRadius;

      normals[i3 + indexOffset[0]] = i < 0 || i > nvertical ? 0 : sin * cosSlant;
      normals[i3 + indexOffset[1]] = i < 0 ? -1 : i > nvertical ? 1 : sinSlant;
      normals[i3 + indexOffset[2]] = i < 0 || i > nvertical ? 0 : cos * cosSlant;

      texCoords[i2 + 0] = j / nradial;
      texCoords[i2 + 1] = v;

      i2 += 2;
      i3 += 3;
    }
  }

  for (let i = 0; i < nvertical + extra; i++) {
    for (let j = 0; j < nradial; j++) {
      const index = (i * nradial + j) * 6;
      indices[index + 0] = vertsAroundEdge * (i + 0) + 0 + j;
      indices[index + 1] = vertsAroundEdge * (i + 0) + 1 + j;
      indices[index + 2] = vertsAroundEdge * (i + 1) + 1 + j;
      indices[index + 3] = vertsAroundEdge * (i + 0) + 0 + j;
      indices[index + 4] = vertsAroundEdge * (i + 1) + 1 + j;
      indices[index + 5] = vertsAroundEdge * (i + 1) + 0 + j;
    }
  }

  return {
    indices,
    attributes: {
      POSITION: {size: 3, value: positions},
      NORMAL: {size: 3, value: normals},
      TEXCOORD_0: {size: 2, value: texCoords}
    }
  };
}

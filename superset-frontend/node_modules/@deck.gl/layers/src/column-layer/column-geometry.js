import {log} from '@deck.gl/core';
import {Geometry, uid} from '@luma.gl/core';

export default class ColumnGeometry extends Geometry {
  constructor(props = {}) {
    const {id = uid('column-geometry')} = props;
    const {indices, attributes} = tesselateColumn(props);
    super({
      ...props,
      id,
      indices,
      attributes
    });
  }
}

/* eslint-disable max-statements, complexity */
function tesselateColumn(props) {
  const {radius, height = 1, nradial = 10, vertices} = props;
  log.assert(!vertices || vertices.length >= nradial);

  const vertsAroundEdge = nradial + 1; // loop
  const numVertices = vertsAroundEdge * 3; // top, side top edge, side bottom edge

  const stepAngle = (Math.PI * 2) / nradial;

  // Used for wireframe
  const indices = new Uint16Array(nradial * 3 * 2); // top loop, side vertical, bottom loop

  const positions = new Float32Array(numVertices * 3);
  const normals = new Float32Array(numVertices * 3);

  let i = 0;

  // side tesselation: 0, 1, 2, 3, 4, 5, ...
  //
  // 0 - 2 - 4  ... top
  // | / | / |
  // 1 - 3 - 5  ... bottom
  //
  for (let j = 0; j < vertsAroundEdge; j++) {
    const a = j * stepAngle;
    const vertex = vertices && vertices[j % nradial];
    const nextVertex = vertices && vertices[(j + 1) % nradial];
    const sin = Math.sin(a);
    const cos = Math.cos(a);

    for (let k = 0; k < 2; k++) {
      positions[i + 0] = vertex ? vertex[0] : cos * radius;
      positions[i + 1] = vertex ? vertex[1] : sin * radius;
      positions[i + 2] = (1 / 2 - k) * height;

      normals[i + 0] = vertex ? nextVertex[0] - vertex[0] : cos;
      normals[i + 1] = vertex ? nextVertex[1] - vertex[1] : sin;

      i += 3;
    }
  }

  // top tesselation: 0, -1, 1, -2, 2, -3, 3, ...
  //
  //    0 -- 1
  //   /      \
  // -1        2
  //  |        |
  // -2        3
  //   \      /
  //   -3 -- 4
  //
  for (let j = 0; j < vertsAroundEdge; j++) {
    const v = Math.floor(j / 2) * Math.sign((j % 2) - 0.5);
    const a = v * stepAngle;
    const vertex = vertices && vertices[(v + nradial) % nradial];
    const sin = Math.sin(a);
    const cos = Math.cos(a);

    positions[i + 0] = vertex ? vertex[0] : cos * radius;
    positions[i + 1] = vertex ? vertex[1] : sin * radius;
    positions[i + 2] = height / 2;

    normals[i + 2] = 1;

    i += 3;
  }

  let index = 0;
  for (let j = 0; j < nradial; j++) {
    // top loop
    indices[index++] = j * 2 + 0;
    indices[index++] = j * 2 + 2;
    // side vertical
    indices[index++] = j * 2 + 0;
    indices[index++] = j * 2 + 1;
    // bottom loop
    indices[index++] = j * 2 + 1;
    indices[index++] = j * 2 + 3;
  }

  return {
    indices,
    attributes: {
      POSITION: {size: 3, value: positions},
      NORMAL: {size: 3, value: normals}
    }
  };
}

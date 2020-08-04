import {Vector3} from 'math.gl';
import Geometry from '../geometry/geometry';
import {uid} from '../utils';

/* eslint-disable comma-spacing, max-statements, complexity */

const ICO_POSITIONS = [-1, 0, 0, 0, 1, 0, 0, 0, -1, 0, 0, 1, 0, -1, 0, 1, 0, 0];
const ICO_INDICES = [3, 4, 5, 3, 5, 1, 3, 1, 0, 3, 0, 4, 4, 0, 2, 4, 2, 5, 2, 0, 1, 5, 2, 1];

export default class IcoSphereGeometry extends Geometry {
  constructor(props = {}) {
    const {id = uid('ico-sphere-geometry')} = props;
    const {indices, attributes} = tesselateIcosaHedron(props);
    super({
      ...props,
      id,
      indices,
      attributes: {...attributes, ...props.attributes}
    });
  }
}

function tesselateIcosaHedron(props) {
  const {iterations = 0} = props;

  const PI = Math.PI;
  const PI2 = PI * 2;

  const positions = [...ICO_POSITIONS];
  let indices = [...ICO_INDICES];

  positions.push();
  indices.push();

  const getMiddlePoint = (() => {
    const pointMemo = {};

    return (i1, i2) => {
      i1 *= 3;
      i2 *= 3;
      const mini = i1 < i2 ? i1 : i2;
      const maxi = i1 > i2 ? i1 : i2;
      const key = `${mini}|${maxi}`;

      if (key in pointMemo) {
        return pointMemo[key];
      }

      const x1 = positions[i1];
      const y1 = positions[i1 + 1];
      const z1 = positions[i1 + 2];
      const x2 = positions[i2];
      const y2 = positions[i2 + 1];
      const z2 = positions[i2 + 2];
      let xm = (x1 + x2) / 2;
      let ym = (y1 + y2) / 2;
      let zm = (z1 + z2) / 2;
      const len = Math.sqrt(xm * xm + ym * ym + zm * zm);

      xm /= len;
      ym /= len;
      zm /= len;

      positions.push(xm, ym, zm);

      return (pointMemo[key] = positions.length / 3 - 1);
    };
  })();

  for (let i = 0; i < iterations; i++) {
    const indices2 = [];
    for (let j = 0; j < indices.length; j += 3) {
      const a = getMiddlePoint(indices[j + 0], indices[j + 1]);
      const b = getMiddlePoint(indices[j + 1], indices[j + 2]);
      const c = getMiddlePoint(indices[j + 2], indices[j + 0]);

      indices2.push(c, indices[j + 0], a, a, indices[j + 1], b, b, indices[j + 2], c, a, b, c);
    }
    indices = indices2;
  }

  // Calculate texCoords and normals
  const normals = new Array(positions.length);
  const texCoords = new Array((positions.length / 3) * 2);

  const l = indices.length;
  for (let i = l - 3; i >= 0; i -= 3) {
    const i1 = indices[i + 0];
    const i2 = indices[i + 1];
    const i3 = indices[i + 2];
    const in1 = i1 * 3;
    const in2 = i2 * 3;
    const in3 = i3 * 3;
    const iu1 = i1 * 2;
    const iu2 = i2 * 2;
    const iu3 = i3 * 2;
    const x1 = positions[in1 + 0];
    const y1 = positions[in1 + 1];
    const z1 = positions[in1 + 2];
    const theta1 = Math.acos(z1 / Math.sqrt(x1 * x1 + y1 * y1 + z1 * z1));
    const phi1 = Math.atan2(y1, x1) + PI;
    const v1 = theta1 / PI;
    const u1 = 1 - phi1 / PI2;
    const x2 = positions[in2 + 0];
    const y2 = positions[in2 + 1];
    const z2 = positions[in2 + 2];
    const theta2 = Math.acos(z2 / Math.sqrt(x2 * x2 + y2 * y2 + z2 * z2));
    const phi2 = Math.atan2(y2, x2) + PI;
    const v2 = theta2 / PI;
    const u2 = 1 - phi2 / PI2;
    const x3 = positions[in3 + 0];
    const y3 = positions[in3 + 1];
    const z3 = positions[in3 + 2];
    const theta3 = Math.acos(z3 / Math.sqrt(x3 * x3 + y3 * y3 + z3 * z3));
    const phi3 = Math.atan2(y3, x3) + PI;
    const v3 = theta3 / PI;
    const u3 = 1 - phi3 / PI2;
    const vec1 = [x3 - x2, y3 - y2, z3 - z2];
    const vec2 = [x1 - x2, y1 - y2, z1 - z2];
    const normal = new Vector3(vec1).cross(vec2).normalize();
    let newIndex;

    if (
      (u1 === 0 || u2 === 0 || u3 === 0) &&
      (u1 === 0 || u1 > 0.5) &&
      (u2 === 0 || u2 > 0.5) &&
      (u3 === 0 || u3 > 0.5)
    ) {
      positions.push(positions[in1 + 0], positions[in1 + 1], positions[in1 + 2]);
      newIndex = positions.length / 3 - 1;
      indices.push(newIndex);
      texCoords[newIndex * 2 + 0] = 1;
      texCoords[newIndex * 2 + 1] = v1;
      normals[newIndex * 3 + 0] = normal.x;
      normals[newIndex * 3 + 1] = normal.y;
      normals[newIndex * 3 + 2] = normal.z;

      positions.push(positions[in2 + 0], positions[in2 + 1], positions[in2 + 2]);
      newIndex = positions.length / 3 - 1;
      indices.push(newIndex);
      texCoords[newIndex * 2 + 0] = 1;
      texCoords[newIndex * 2 + 1] = v2;
      normals[newIndex * 3 + 0] = normal.x;
      normals[newIndex * 3 + 1] = normal.y;
      normals[newIndex * 3 + 2] = normal.z;

      positions.push(positions[in3 + 0], positions[in3 + 1], positions[in3 + 2]);
      newIndex = positions.length / 3 - 1;
      indices.push(newIndex);
      texCoords[newIndex * 2 + 0] = 1;
      texCoords[newIndex * 2 + 1] = v3;
      normals[newIndex * 3 + 0] = normal.x;
      normals[newIndex * 3 + 1] = normal.y;
      normals[newIndex * 3 + 2] = normal.z;
    }

    normals[in1 + 0] = normals[in2 + 0] = normals[in3 + 0] = normal.x;
    normals[in1 + 1] = normals[in2 + 1] = normals[in3 + 1] = normal.y;
    normals[in1 + 2] = normals[in2 + 2] = normals[in3 + 2] = normal.z;

    texCoords[iu1 + 0] = u1;
    texCoords[iu1 + 1] = v1;

    texCoords[iu2 + 0] = u2;
    texCoords[iu2 + 1] = v2;

    texCoords[iu3 + 0] = u3;
    texCoords[iu3 + 1] = v3;
  }

  return {
    indices: {size: 1, value: new Uint16Array(indices)},
    attributes: {
      POSITION: {size: 3, value: new Float32Array(positions)},
      NORMAL: {size: 3, value: new Float32Array(normals)},
      TEXCOORD_0: {size: 2, value: new Float32Array(texCoords)}
    }
  };
}

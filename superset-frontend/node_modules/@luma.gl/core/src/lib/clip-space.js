// ClipSpace
import GL from '@luma.gl/constants';
import Model from '../lib/model';
import Geometry from '../geometry/geometry';

const CLIPSPACE_VERTEX_SHADER = `\
attribute vec2 aClipSpacePosition;
attribute vec2 aTexCoord;
attribute vec2 aCoordinate;

varying vec2 position;
varying vec2 coordinate;
varying vec2 uv;

void main(void) {
  gl_Position = vec4(aClipSpacePosition, 0., 1.);
  position = aClipSpacePosition;
  coordinate = aCoordinate;
  uv = aTexCoord;
}
`;

/* eslint-disable indent, no-multi-spaces */
const POSITIONS = [-1, -1, 1, -1, -1, 1, 1, 1];

export default class ClipSpace extends Model {
  constructor(gl, opts) {
    const TEX_COORDS = POSITIONS.map(coord => (coord === -1 ? 0 : coord));

    super(
      gl,
      Object.assign({}, opts, {
        vs: CLIPSPACE_VERTEX_SHADER,
        geometry: new Geometry({
          drawMode: GL.TRIANGLE_STRIP,
          vertexCount: 4,
          attributes: {
            aClipSpacePosition: {size: 2, value: new Float32Array(POSITIONS)},
            aTexCoord: {size: 2, value: new Float32Array(TEX_COORDS)},
            aCoordinate: {size: 2, value: new Float32Array(TEX_COORDS)}
          }
        })
      })
    );
    this.setVertexCount(4);
  }
}

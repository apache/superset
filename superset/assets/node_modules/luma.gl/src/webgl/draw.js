/* eslint-disable */
// TODO - generic draw call
// One of the good things about GL is that there are so many ways to draw things
import GL from '../constants';
import {assertWebGLContext, assertWebGL2Context, getKeyValue} from '../webgl-utils';
import assert from '../utils/assert';

// A good thing about webGL is that there are so many ways to draw things,
// e.g. depending on whether data is indexed and/or isInstanced.
// This function unifies those into a single call with simple parameters
// that have sane defaults.
export function draw(gl, {
  drawMode = GL.TRIANGLES,
  vertexCount,
  offset = 0,
  isIndexed = false,
  indexType = GL.UNSIGNED_SHORT,
  isInstanced = false,
  instanceCount = 0
}) {
  assertWebGLContext(gl);

  const extension = gl.getExtension('ANGLE_instanced_arrays');

  // TODO - Use polyfilled WebGL2RenderingContext instead of ANGLE extension
  if (isInstanced) {
    const webgl2 = isWebGL2(gl);
    const extension = gl.getExtension('ANGLE_instanced_arrays');
    const context = webgl2 ? gl : extension;
    const suffix = webgl2 ? '' : 'ANGLE';
    const drawElements = 'drawElementsInstanced' + suffix;
    const drawArrays = 'drawArraysInstanced' + suffix;

    if (isIndexed) {
      context[drawElements](
        drawMode, vertexCount, indexType, offset, instanceCount
      );
    } else {
      context[drawArrays](
        drawMode, offset, vertexCount, instanceCount
      );
    }
  } else if (isIndexed) {
    gl.drawElements(drawMode, vertexCount, indexType, offset);
  } else {
    gl.drawArrays(drawMode, offset, vertexCount);
  }
}

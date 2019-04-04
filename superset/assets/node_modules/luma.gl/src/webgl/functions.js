/* eslint-disable */
// TODO - generic draw call
// One of the good things about GL is that there are so many ways to draw things
import GL from '../constants';
import {withParameters} from '../webgl-context';
import {assertWebGLContext, assertWebGL2Context, getKey} from '../webgl-utils';
import assert from '../utils/assert';

/**
 * Read pixels from a target
 *
 * Will read from the currently bound framebuffer, or the currently bound
 *  drawing buffer - if context has been created with
 *  preserveDrawingBuffers
 *
 * @param {WebGLRenderingContext} gl
 * @param {Object} opts
 * @param {Number} opts.x - leftmost coord to be read
 * @param {Number} opts.y - bottommost (or topmost if sourceHeight supplied)
 * @param {Number} opts.width=1 - width of area to be read
 * @param {Number} opts.height=1 - height of area to be read
 * @param {Number} opts.sourceHeight= - target height, implies top left coords
 * @param {Number} opts.dataOffset=0 - WebGL2 only - offset into data array
 * @param {Number} opts.format=GL.RBGA - Can be set to GL.RGB or GL.ALPHA
 *
 * @return {ArrayView} - types array, either passed in or autoallocated
 */
export function readPixels(gl, {
  x,
  y,
  width = 1,
  height = 1,
  data,
  dataOffset = 0,
  type = GL.UNSIGNED_BYTE,
  sourceHeight,
  format = GL.RGBA
}) {
  // Read color in the central pixel, to be mapped with picking colors
  data = data || new Uint8Array(4 * width * height);
  // If source height is specified, a top left coordinate system is used
  y = sourceHeight ? sourceHeight - y : y;
  if (dataOffset) {
    assertWebGL2Context(gl);
    gl.readPixels(x, y, width, height, format, type, data, dataOffset);
  } else {
    gl.readPixels(x, y, width, height, format, type, data);
  }
  return data;
}

/**
 * Read pixels directly into webgl buffer
 * NOTE: WebGL2 only
 *
 * @param {WebGLRenderingContext} gl
 * @param {Object} options
 * @return {WebGLBuffer} the passed in buffer
 */
export function readPixelsToBuffer(gl, {
  x,
  y,
  width = 1,
  height = 1,
  buffer,
  dataOffset = 0,
  type = GL.UNSIGNED_BYTE,
  sourceHeight,
  format = GL.RGBA
}) {
  assertWebGL2Context(gl);

  // If source height is specified, a top left coordinate system is used
  y = sourceHeight ? sourceHeight - y : y;

  gl.bindBuffer(GL.PIXEL_PACK_BUFFER, buffer.handle);

  gl.readPixels(x, y, width, height, format, type, dataOffset);

  gl.bindBuffer(GL.PIXEL_PACK_BUFFER, null);

  return buffer;
}

/*
* @param {} opt.filter
 */
export function blitFramebuffer(gl, {
  source: [sourceX, sourceY, sourceWidth, sourceHeight],
  dest: [destX, destY, destWidth, destHeight],
  mask = GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT | GL.STENCIL_BUFFER_BIT,
  filter = GL.LINEAR
}) {
}

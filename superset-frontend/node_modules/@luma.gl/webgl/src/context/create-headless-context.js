import {headlessGL} from '../webgl-utils/webgl-types';

const ERR_HEADLESSGL_NOT_AVAILABLE =
  'Failed to create WebGL context in Node.js, headless gl not available';

const ERR_HEADLESSGL_FAILED =
  'Failed to create WebGL context in Node.js, headless gl returned null';

// Create headless gl context (for running under Node.js)
export function createHeadlessContext(options) {
  const {width, height, webgl1, webgl2, onError} = options;
  if (webgl2 && !webgl1) {
    return onError('headless-gl does not support WebGL2');
  }
  if (!headlessGL) {
    return onError(ERR_HEADLESSGL_NOT_AVAILABLE);
  }
  const gl = headlessGL(width, height, options);
  if (!gl) {
    return onError(ERR_HEADLESSGL_FAILED);
  }
  return gl;
}

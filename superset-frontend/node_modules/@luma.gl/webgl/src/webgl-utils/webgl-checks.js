// import {WebGLRenderingContext, WebGL2RenderingContext} from './webgl-types';
import {assert} from '../utils';

// Heuristic testing of contexts (to indentify debug wrappers around gl contexts)
// const GL_ARRAY_BUFFER = 0x8892;

export const ERR_CONTEXT = 'Invalid WebGLRenderingContext';
export const ERR_WEBGL = ERR_CONTEXT;
export const ERR_WEBGL2 = 'Requires WebGL2';

export function isWebGL(gl) {
  return Boolean(gl && Number.isFinite(gl._version));
}

export function isWebGL2(gl) {
  return Boolean(gl && gl._version === 2);
}

export function assertWebGLContext(gl) {
  // Need to handle debug context
  assert(isWebGL(gl), ERR_CONTEXT);
}

export function assertWebGL2Context(gl) {
  // Need to handle debug context
  assert(isWebGL2(gl), ERR_WEBGL2);
}

/* eslint-disable no-inline-comments, max-len */
import GL from '../constants';
import {
  pushContextState,
  popContextState
} from '../webgl-context/track-context-state';
import {
  getParameter,
  getParameters,
  setParameter,
  setParameters as glSetParameters,
  resetParameters,
  getModifiedParameters
} from '../webgl-context/set-parameters';
import {isObjectEmpty} from '../utils';
import assert from '../utils/assert';

// map of parameter setter function names, parameter constants, default values and types
// - Uses gl function names, except when setter function exist that are named differently
// - When the WebGL api offers <setter> and <setter>Separate (e.g. blendEquation and
//   blendEquationSeparate, we use non-separate name, but accept both non-separate and
//   separate arguments. Thus, a `getParameter` call will always return all the separate values
//   in an array, in a form that can be accepted by the setter.
export const LUMA_SETTERS = {
  framebuffer: (gl, framebuffer) => {
    const handle = framebuffer && framebuffer.handle ? framebuffer.handle : framebuffer;
    return gl.bindFramebuffer(GL.FRAMEBUFFER, handle);
  },
  blend: (gl, value) => value ? gl.enable(GL.BLEND) : gl.disable(GL.BLEND),
  blendColor: (gl, value) => gl.blendColor(...value),
  blendEquation: (gl, args) => {
    args = isArray(args) ? args : [args, args];
    gl.blendEquationSeparate(...args);
  },
  blendFunc: (gl, args) => {
    args = isArray(args) && args.length === 2 ? [...args, ...args] : args;
    gl.blendFuncSeparate(...args);
  },

  clearColor: (gl, value) => gl.clearColor(...value),
  clearDepth: (gl, value) => gl.clearDepth(value),
  clearStencil: (gl, value) => gl.clearStencil(value),

  colorMask: (gl, value) => gl.colorMask(...value),

  cull: (gl, value) => value ? gl.enable(GL.CULL_FACE) : gl.disable(GL.CULL_FACE),
  cullFace: (gl, value) => gl.cullFace(value),

  depthTest: (gl, value) => value ? gl.enable(GL.DEPTH_TEST) : gl.disable(GL.DEPTH_TEST),
  depthFunc: (gl, value) => gl.depthFunc(value),
  depthMask: (gl, value) => gl.depthMask(value),
  depthRange: (gl, value) => gl.depthRange(...value),

  dither: (gl, value) => value ? gl.enable(GL.DITHER) : gl.disable(GL.DITHER),

  derivativeHint: (gl, value) => {
    // gl1: 'OES_standard_derivatives'
    gl.hint(GL.FRAGMENT_SHADER_DERIVATIVE_HINT, value);
  },

  frontFace: (gl, value) => gl.frontFace(value),

  mipmapHint: (gl, value) => gl.hint(GL.GENERATE_MIPMAP_HINT, value),

  lineWidth: (gl, value) => gl.lineWidth(value),

  polygonOffsetFill: (gl, value) =>
    value ? gl.enable(GL.POLYGON_OFFSET_FILL) : gl.disable(GL.POLYGON_OFFSET_FILL),
  polygonOffset: (gl, value) => gl.polygonOffset(...value),

  sampleCoverage: (gl, value) => gl.sampleCoverage(...value),

  scissorTest: (gl, value) => value ? gl.enable(GL.SCISSOR_TEST) : gl.disable(GL.SCISSOR_TEST),
  scissor: (gl, value) => gl.scissor(...value),

  stencilTest: (gl, value) => value ? gl.enable(GL.STENCIL_TEST) : gl.disable(GL.STENCIL_TEST),
  stencilMask: (gl, value) => {
    value = isArray(value) ? value : [value, value];
    const [mask, backMask] = value;
    gl.stencilMaskSeparate(GL.FRONT, mask);
    gl.stencilMaskSeparate(GL.BACK, backMask);
  },
  stencilFunc: (gl, args) => {
    args = isArray(args) && args.length === 3 ? [...args, ...args] : args;
    const [func, ref, mask, backFunc, backRef, backMask] = args;
    gl.stencilFuncSeparate(GL.FRONT, func, ref, mask);
    gl.stencilFuncSeparate(GL.BACK, backFunc, backRef, backMask);
  },
  stencilOp: (gl, args) => {
    args = isArray(args) && args.length === 3 ? [...args, ...args] : args;
    const [sfail, dpfail, dppass, backSfail, backDpfail, backDppass] = args;
    gl.stencilOpSeparate(GL.FRONT, sfail, dpfail, dppass);
    gl.stencilOpSeparate(GL.BACK, backSfail, backDpfail, backDppass);
  },

  viewport: (gl, value) => gl.viewport(...value)
};

// HELPERS

function isArray(array) {
  return Array.isArray(array) || ArrayBuffer.isView(array);
}

// GETTERS AND SETTERS

// Get the parameter value(s) from the context
export {getParameter}; // from '../webgl-utils/set-parameters'

// Get the parameters from the context
export {getParameters}; // from '../webgl-utils/set-parameters'

// Resets gl state to default values.
export {setParameter}; // from '../webgl-utils/set-parameters'

// Resets gl state to default values.
export {resetParameters}; // from '../webgl-utils/set-parameters'

// Get a map of modified parameters
export {getModifiedParameters};

// Note: "setParameters" is given extra treatment below

// Set the parameter value(s) by key to the context
// Sets value with key to context.
// Value may be "normalized" (in case a short form is supported). In that case
// the normalized value is retured.
export function setParameters(gl, parameters) {
  glSetParameters(gl, parameters);
  for (const key in parameters) {
    const setter = LUMA_SETTERS[key];
    if (setter) {
      setter(gl, parameters[key], key);
    }
  }
}

// VERY LIMITED / BASIC GL STATE MANAGEMENT
// Executes a function with gl states temporarily set, exception safe
// Currently support pixelStorage, scissor test and framebuffer binding
export function withParameters(gl, parameters, func) {
  // assertWebGLContext(gl);

  if (isObjectEmpty(parameters)) {
    // Avoid setting state if no parameters provided. Just call and return
    return func(gl);
  }

  const {nocatch = true} = parameters;
  // frameBuffer not supported use framebuffer
  assert(!parameters.frameBuffer);

  pushContextState(gl);
  setParameters(gl, parameters);

  // Setup is done, call the function
  let value;

  if (nocatch) {
    // Avoid try catch to minimize stack size impact for safe execution paths
    value = func(gl);
    popContextState(gl);
  } else {
    // Wrap in a try-catch to ensure that parameters are restored on exceptions
    try {
      value = func(gl);
    } finally {
      popContextState(gl);
    }
  }

  return value;
}

// map of parameter setter function names, parameter constants, default values and types
// - Uses gl function names, except when setter function exist that are named differently
// - When the WebGL api offers <setter> and <setter>Separate (e.g. blendEquation and
//   blendEquationSeparate, we use non-separate name, but accept both non-separate and
//   separate arguments. Thus, a `getParameter` call will always return all the separate values
//   in an array, in a form that can be accepted by the setter.

import GL from '@luma.gl/constants';

// HELPERS

function isArray(array) {
  return Array.isArray(array) || ArrayBuffer.isView(array);
}

export default {
  framebuffer: (gl, framebuffer) => {
    // accepts 1) a WebGLFramebuffer 2) null (default framebuffer), or 3) luma.gl Framebuffer class
    // framebuffer is null when restoring to default framebuffer, otherwise use the WebGL handle.
    const handle = framebuffer && 'handle' in framebuffer ? framebuffer.handle : framebuffer;
    return gl.bindFramebuffer(GL.FRAMEBUFFER, handle);
  },
  blend: (gl, value) => (value ? gl.enable(GL.BLEND) : gl.disable(GL.BLEND)),
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

  cull: (gl, value) => (value ? gl.enable(GL.CULL_FACE) : gl.disable(GL.CULL_FACE)),
  cullFace: (gl, value) => gl.cullFace(value),

  depthTest: (gl, value) => (value ? gl.enable(GL.DEPTH_TEST) : gl.disable(GL.DEPTH_TEST)),
  depthFunc: (gl, value) => gl.depthFunc(value),
  depthMask: (gl, value) => gl.depthMask(value),
  depthRange: (gl, value) => gl.depthRange(...value),

  dither: (gl, value) => (value ? gl.enable(GL.DITHER) : gl.disable(GL.DITHER)),

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

  scissorTest: (gl, value) => (value ? gl.enable(GL.SCISSOR_TEST) : gl.disable(GL.SCISSOR_TEST)),
  scissor: (gl, value) => gl.scissor(...value),

  stencilTest: (gl, value) => (value ? gl.enable(GL.STENCIL_TEST) : gl.disable(GL.STENCIL_TEST)),
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

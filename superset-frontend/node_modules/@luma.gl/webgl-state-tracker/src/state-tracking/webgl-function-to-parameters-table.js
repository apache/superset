// Replacements for WebGL state setting functions that call supplied 'update'
// function setting the individual parameters.
// i.e. these "setters" map functions to gl parameters

// The 'update' function is used to interceptor WEBGL functions that set
// WebGLRenderingContext state so that state changes can be tracked.

// It also enables checking values against cache and avoid unnecessary WebGL
// set/get operations.

import GL from '@luma.gl/constants';

export default {
  // GENERIC SETTERS

  enable: (update, capability) =>
    update({
      [capability]: true
    }),
  disable: (update, capability) =>
    update({
      [capability]: false
    }),
  pixelStorei: (update, pname, value) =>
    update({
      [pname]: value
    }),
  hint: (update, pname, hint) =>
    update({
      [pname]: hint
    }),

  // SPECIFIC SETTERS

  bindFramebuffer: (update, target, framebuffer) => {
    switch (target) {
      case GL.FRAMEBUFFER:
        return update({
          [GL.DRAW_FRAMEBUFFER_BINDING]: framebuffer,
          [GL.READ_FRAMEBUFFER_BINDING]: framebuffer
        });
      case GL.DRAW_FRAMEBUFFER:
        return update({[GL.DRAW_FRAMEBUFFER_BINDING]: framebuffer});
      case GL.READ_FRAMEBUFFER:
        return update({[GL.READ_FRAMEBUFFER_BINDING]: framebuffer});
      default:
        return null;
    }
  },
  blendColor: (update, r, g, b, a) =>
    update({
      [GL.BLEND_COLOR]: new Float32Array([r, g, b, a])
    }),

  blendEquation: (update, mode) =>
    update({
      [GL.BLEND_EQUATION_RGB]: mode,
      [GL.BLEND_EQUATION_ALPHA]: mode
    }),

  blendEquationSeparate: (update, modeRGB, modeAlpha) =>
    update({
      [GL.BLEND_EQUATION_RGB]: modeRGB,
      [GL.BLEND_EQUATION_ALPHA]: modeAlpha
    }),

  blendFunc: (update, src, dst) =>
    update({
      [GL.BLEND_SRC_RGB]: src,
      [GL.BLEND_DST_RGB]: dst,
      [GL.BLEND_SRC_ALPHA]: src,
      [GL.BLEND_DST_ALPHA]: dst
    }),

  blendFuncSeparate: (update, srcRGB, dstRGB, srcAlpha, dstAlpha) =>
    update({
      [GL.BLEND_SRC_RGB]: srcRGB,
      [GL.BLEND_DST_RGB]: dstRGB,
      [GL.BLEND_SRC_ALPHA]: srcAlpha,
      [GL.BLEND_DST_ALPHA]: dstAlpha
    }),

  clearColor: (update, r, g, b, a) =>
    update({
      [GL.COLOR_CLEAR_VALUE]: new Float32Array([r, g, b, a])
    }),

  clearDepth: (update, depth) =>
    update({
      [GL.DEPTH_CLEAR_VALUE]: depth
    }),

  clearStencil: (update, s) =>
    update({
      [GL.STENCIL_CLEAR_VALUE]: s
    }),

  colorMask: (update, r, g, b, a) =>
    update({
      [GL.COLOR_WRITEMASK]: [r, g, b, a]
    }),

  cullFace: (update, mode) =>
    update({
      [GL.CULL_FACE_MODE]: mode
    }),

  depthFunc: (update, func) =>
    update({
      [GL.DEPTH_FUNC]: func
    }),

  depthRange: (update, zNear, zFar) =>
    update({
      [GL.DEPTH_RANGE]: new Float32Array([zNear, zFar])
    }),

  depthMask: (update, mask) =>
    update({
      [GL.DEPTH_WRITEMASK]: mask
    }),

  frontFace: (update, face) =>
    update({
      [GL.FRONT_FACE]: face
    }),

  lineWidth: (update, width) =>
    update({
      [GL.LINE_WIDTH]: width
    }),

  polygonOffset: (update, factor, units) =>
    update({
      [GL.POLYGON_OFFSET_FACTOR]: factor,
      [GL.POLYGON_OFFSET_UNITS]: units
    }),

  sampleCoverage: (update, value, invert) =>
    update({
      [GL.SAMPLE_COVERAGE_VALUE]: value,
      [GL.SAMPLE_COVERAGE_INVERT]: invert
    }),

  scissor: (update, x, y, width, height) =>
    update({
      [GL.SCISSOR_BOX]: new Int32Array([x, y, width, height])
    }),

  stencilMask: (update, mask) =>
    update({
      [GL.STENCIL_WRITEMASK]: mask,
      [GL.STENCIL_BACK_WRITEMASK]: mask
    }),

  stencilMaskSeparate: (update, face, mask) =>
    update({
      [face === GL.FRONT ? GL.STENCIL_WRITEMASK : GL.STENCIL_BACK_WRITEMASK]: mask
    }),

  stencilFunc: (update, func, ref, mask) =>
    update({
      [GL.STENCIL_FUNC]: func,
      [GL.STENCIL_REF]: ref,
      [GL.STENCIL_VALUE_MASK]: mask,
      [GL.STENCIL_BACK_FUNC]: func,
      [GL.STENCIL_BACK_REF]: ref,
      [GL.STENCIL_BACK_VALUE_MASK]: mask
    }),

  stencilFuncSeparate: (update, face, func, ref, mask) =>
    update({
      [face === GL.FRONT ? GL.STENCIL_FUNC : GL.STENCIL_BACK_FUNC]: func,
      [face === GL.FRONT ? GL.STENCIL_REF : GL.STENCIL_BACK_REF]: ref,
      [face === GL.FRONT ? GL.STENCIL_VALUE_MASK : GL.STENCIL_BACK_VALUE_MASK]: mask
    }),

  stencilOp: (update, fail, zfail, zpass) =>
    update({
      [GL.STENCIL_FAIL]: fail,
      [GL.STENCIL_PASS_DEPTH_FAIL]: zfail,
      [GL.STENCIL_PASS_DEPTH_PASS]: zpass,
      [GL.STENCIL_BACK_FAIL]: fail,
      [GL.STENCIL_BACK_PASS_DEPTH_FAIL]: zfail,
      [GL.STENCIL_BACK_PASS_DEPTH_PASS]: zpass
    }),

  stencilOpSeparate: (update, face, fail, zfail, zpass) =>
    update({
      [face === GL.FRONT ? GL.STENCIL_FAIL : GL.STENCIL_BACK_FAIL]: fail,
      [face === GL.FRONT ? GL.STENCIL_PASS_DEPTH_FAIL : GL.STENCIL_BACK_PASS_DEPTH_FAIL]: zfail,
      [face === GL.FRONT ? GL.STENCIL_PASS_DEPTH_PASS : GL.STENCIL_BACK_PASS_DEPTH_PASS]: zpass
    }),

  viewport: (update, x, y, width, height) =>
    update({
      [GL.VIEWPORT]: new Int32Array([x, y, width, height])
    })
};

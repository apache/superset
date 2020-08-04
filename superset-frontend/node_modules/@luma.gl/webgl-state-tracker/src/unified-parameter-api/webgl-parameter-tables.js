// Tables describing WebGL parameters
import GL from '@luma.gl/constants';
import {isWebGL2} from '../utils';

// DEFAULT SETTINGS - FOR FAST CACHE INITIALIZATION AND CONTEXT RESETS

export const GL_PARAMETER_DEFAULTS = {
  [GL.BLEND]: false,
  [GL.BLEND_COLOR]: new Float32Array([0, 0, 0, 0]),
  [GL.BLEND_EQUATION_RGB]: GL.FUNC_ADD,
  [GL.BLEND_EQUATION_ALPHA]: GL.FUNC_ADD,
  [GL.BLEND_SRC_RGB]: GL.ONE,
  [GL.BLEND_DST_RGB]: GL.ZERO,
  [GL.BLEND_SRC_ALPHA]: GL.ONE,
  [GL.BLEND_DST_ALPHA]: GL.ZERO,
  [GL.COLOR_CLEAR_VALUE]: new Float32Array([0, 0, 0, 0]), // TBD
  [GL.COLOR_WRITEMASK]: [true, true, true, true],
  [GL.CULL_FACE]: false,
  [GL.CULL_FACE_MODE]: GL.BACK,
  [GL.DEPTH_TEST]: false,
  [GL.DEPTH_CLEAR_VALUE]: 1,
  [GL.DEPTH_FUNC]: GL.LESS,
  [GL.DEPTH_RANGE]: new Float32Array([0, 1]), // TBD
  [GL.DEPTH_WRITEMASK]: true,
  [GL.DITHER]: true,
  // FRAMEBUFFER_BINDING and DRAW_FRAMEBUFFER_BINDING(WebGL2) refer same state.
  [GL.FRAMEBUFFER_BINDING]: null,
  [GL.FRONT_FACE]: GL.CCW,
  [GL.GENERATE_MIPMAP_HINT]: GL.DONT_CARE,
  [GL.LINE_WIDTH]: 1,
  [GL.POLYGON_OFFSET_FILL]: false,
  [GL.POLYGON_OFFSET_FACTOR]: 0,
  [GL.POLYGON_OFFSET_UNITS]: 0,
  [GL.SAMPLE_COVERAGE_VALUE]: 1.0,
  [GL.SAMPLE_COVERAGE_INVERT]: false,
  [GL.SCISSOR_TEST]: false,
  // Note: Dynamic value. If scissor test enabled we expect users to set correct scissor box
  [GL.SCISSOR_BOX]: new Int32Array([0, 0, 1024, 1024]),
  [GL.STENCIL_TEST]: false,
  [GL.STENCIL_CLEAR_VALUE]: 0,
  [GL.STENCIL_WRITEMASK]: 0xffffffff,
  [GL.STENCIL_BACK_WRITEMASK]: 0xffffffff,
  [GL.STENCIL_FUNC]: GL.ALWAYS,
  [GL.STENCIL_REF]: 0,
  [GL.STENCIL_VALUE_MASK]: 0xffffffff,
  [GL.STENCIL_BACK_FUNC]: GL.ALWAYS,
  [GL.STENCIL_BACK_REF]: 0,
  [GL.STENCIL_BACK_VALUE_MASK]: 0xffffffff,
  [GL.STENCIL_FAIL]: GL.KEEP,
  [GL.STENCIL_PASS_DEPTH_FAIL]: GL.KEEP,
  [GL.STENCIL_PASS_DEPTH_PASS]: GL.KEEP,
  [GL.STENCIL_BACK_FAIL]: GL.KEEP,
  [GL.STENCIL_BACK_PASS_DEPTH_FAIL]: GL.KEEP,
  [GL.STENCIL_BACK_PASS_DEPTH_PASS]: GL.KEEP,
  // Dynamic value: We use [0, 0, 1024, 1024] as default, but usually this is updated in each frame.
  [GL.VIEWPORT]: new Int32Array([0, 0, 1024, 1024]),
  // WEBGL1 PIXEL PACK/UNPACK MODES
  [GL.PACK_ALIGNMENT]: 4,
  [GL.UNPACK_ALIGNMENT]: 4,
  [GL.UNPACK_FLIP_Y_WEBGL]: false,
  [GL.UNPACK_PREMULTIPLY_ALPHA_WEBGL]: false,
  [GL.UNPACK_COLORSPACE_CONVERSION_WEBGL]: GL.BROWSER_DEFAULT_WEBGL,

  // WEBGL2 / EXTENSIONS
  // gl1: 'OES_standard_derivatives'
  [GL.FRAGMENT_SHADER_DERIVATIVE_HINT]: GL.DONT_CARE,
  [GL.READ_FRAMEBUFFER_BINDING]: null,
  [GL.RASTERIZER_DISCARD]: false,
  [GL.PACK_ROW_LENGTH]: 0,
  [GL.PACK_SKIP_PIXELS]: 0,
  [GL.PACK_SKIP_ROWS]: 0,
  [GL.UNPACK_ROW_LENGTH]: 0,
  [GL.UNPACK_IMAGE_HEIGHT]: 0,
  [GL.UNPACK_SKIP_PIXELS]: 0,
  [GL.UNPACK_SKIP_ROWS]: 0,
  [GL.UNPACK_SKIP_IMAGES]: 0
};

// SETTER TABLES - ENABLES SETTING ANY PARAMETER WITH A COMMON API

const enable = (gl, value, key) => (value ? gl.enable(key) : gl.disable(key));
const hint = (gl, value, key) => gl.hint(key, value);
const pixelStorei = (gl, value, key) => gl.pixelStorei(key, value);

const drawFramebuffer = (gl, value) => {
  const target = isWebGL2(gl) ? GL.DRAW_FRAMEBUFFER : GL.FRAMEBUFFER;
  return gl.bindFramebuffer(target, value);
};
const readFramebuffer = (gl, value) => {
  return gl.bindFramebuffer(GL.READ_FRAMEBUFFER, value);
};

// Map from WebGL parameter names to corresponding WebGL setter functions
// WegGL constants are read by parameter names, but set by function names
// NOTE: When value type is a string, it will be handled by 'GL_COMPOSITE_PARAMETER_SETTERS'
export const GL_PARAMETER_SETTERS = {
  [GL.BLEND]: enable,
  [GL.BLEND_COLOR]: (gl, value) => gl.blendColor(...value),
  [GL.BLEND_EQUATION_RGB]: 'blendEquation',
  [GL.BLEND_EQUATION_ALPHA]: 'blendEquation',
  [GL.BLEND_SRC_RGB]: 'blendFunc',
  [GL.BLEND_DST_RGB]: 'blendFunc',
  [GL.BLEND_SRC_ALPHA]: 'blendFunc',
  [GL.BLEND_DST_ALPHA]: 'blendFunc',
  [GL.COLOR_CLEAR_VALUE]: (gl, value) => gl.clearColor(...value),
  [GL.COLOR_WRITEMASK]: (gl, value) => gl.colorMask(...value),
  [GL.CULL_FACE]: enable,
  [GL.CULL_FACE_MODE]: (gl, value) => gl.cullFace(value),
  [GL.DEPTH_TEST]: enable,
  [GL.DEPTH_CLEAR_VALUE]: (gl, value) => gl.clearDepth(value),
  [GL.DEPTH_FUNC]: (gl, value) => gl.depthFunc(value),
  [GL.DEPTH_RANGE]: (gl, value) => gl.depthRange(...value),
  [GL.DEPTH_WRITEMASK]: (gl, value) => gl.depthMask(value),
  [GL.DITHER]: enable,
  [GL.FRAGMENT_SHADER_DERIVATIVE_HINT]: hint,
  // NOTE: FRAMEBUFFER_BINDING and DRAW_FRAMEBUFFER_BINDING(WebGL2) refer same state.
  [GL.FRAMEBUFFER_BINDING]: drawFramebuffer,
  [GL.FRONT_FACE]: (gl, value) => gl.frontFace(value),
  [GL.GENERATE_MIPMAP_HINT]: hint,
  [GL.LINE_WIDTH]: (gl, value) => gl.lineWidth(value),
  [GL.POLYGON_OFFSET_FILL]: enable,
  [GL.POLYGON_OFFSET_FACTOR]: 'polygonOffset',
  [GL.POLYGON_OFFSET_UNITS]: 'polygonOffset',
  [GL.RASTERIZER_DISCARD]: enable,
  [GL.SAMPLE_COVERAGE_VALUE]: 'sampleCoverage',
  [GL.SAMPLE_COVERAGE_INVERT]: 'sampleCoverage',
  [GL.SCISSOR_TEST]: enable,
  [GL.SCISSOR_BOX]: (gl, value) => gl.scissor(...value),
  [GL.STENCIL_TEST]: enable,
  [GL.STENCIL_CLEAR_VALUE]: (gl, value) => gl.clearStencil(value),
  [GL.STENCIL_WRITEMASK]: (gl, value) => gl.stencilMaskSeparate(GL.FRONT, value),
  [GL.STENCIL_BACK_WRITEMASK]: (gl, value) => gl.stencilMaskSeparate(GL.BACK, value),
  [GL.STENCIL_FUNC]: 'stencilFuncFront',
  [GL.STENCIL_REF]: 'stencilFuncFront',
  [GL.STENCIL_VALUE_MASK]: 'stencilFuncFront',
  [GL.STENCIL_BACK_FUNC]: 'stencilFuncBack',
  [GL.STENCIL_BACK_REF]: 'stencilFuncBack',
  [GL.STENCIL_BACK_VALUE_MASK]: 'stencilFuncBack',
  [GL.STENCIL_FAIL]: 'stencilOpFront',
  [GL.STENCIL_PASS_DEPTH_FAIL]: 'stencilOpFront',
  [GL.STENCIL_PASS_DEPTH_PASS]: 'stencilOpFront',
  [GL.STENCIL_BACK_FAIL]: 'stencilOpBack',
  [GL.STENCIL_BACK_PASS_DEPTH_FAIL]: 'stencilOpBack',
  [GL.STENCIL_BACK_PASS_DEPTH_PASS]: 'stencilOpBack',
  [GL.VIEWPORT]: (gl, value) => gl.viewport(...value),

  // WEBGL1 PIXEL PACK/UNPACK MODES
  [GL.PACK_ALIGNMENT]: pixelStorei,
  [GL.UNPACK_ALIGNMENT]: pixelStorei,
  [GL.UNPACK_FLIP_Y_WEBGL]: pixelStorei,
  [GL.UNPACK_PREMULTIPLY_ALPHA_WEBGL]: pixelStorei,
  [GL.UNPACK_COLORSPACE_CONVERSION_WEBGL]: pixelStorei,

  // WEBGL2 PIXEL PACK/UNPACK MODES
  // RASTERIZER_DISCARD ...
  [GL.PACK_ROW_LENGTH]: pixelStorei,
  [GL.PACK_SKIP_PIXELS]: pixelStorei,
  [GL.PACK_SKIP_ROWS]: pixelStorei,
  [GL.READ_FRAMEBUFFER_BINDING]: readFramebuffer,
  [GL.UNPACK_ROW_LENGTH]: pixelStorei,
  [GL.UNPACK_IMAGE_HEIGHT]: pixelStorei,
  [GL.UNPACK_SKIP_PIXELS]: pixelStorei,
  [GL.UNPACK_SKIP_ROWS]: pixelStorei,
  [GL.UNPACK_SKIP_IMAGES]: pixelStorei
};

// COMPOSITE_WEBGL_PARAMETER_
export const GL_COMPOSITE_PARAMETER_SETTERS = {
  blendEquation: (gl, values) =>
    gl.blendEquationSeparate(values[GL.BLEND_EQUATION_RGB], values[GL.BLEND_EQUATION_ALPHA]),
  blendFunc: (gl, values) =>
    gl.blendFuncSeparate(
      values[GL.BLEND_SRC_RGB],
      values[GL.BLEND_DST_RGB],
      values[GL.BLEND_SRC_ALPHA],
      values[GL.BLEND_DST_ALPHA]
    ),
  polygonOffset: (gl, values) =>
    gl.polygonOffset(values[GL.POLYGON_OFFSET_FACTOR], values[GL.POLYGON_OFFSET_UNITS]),
  sampleCoverage: (gl, values) =>
    gl.sampleCoverage(values[GL.SAMPLE_COVERAGE_VALUE], values[GL.SAMPLE_COVERAGE_INVERT]),
  stencilFuncFront: (gl, values) =>
    gl.stencilFuncSeparate(
      GL.FRONT,
      values[GL.STENCIL_FUNC],
      values[GL.STENCIL_REF],
      values[GL.STENCIL_VALUE_MASK]
    ),
  stencilFuncBack: (gl, values) =>
    gl.stencilFuncSeparate(
      GL.BACK,
      values[GL.STENCIL_BACK_FUNC],
      values[GL.STENCIL_BACK_REF],
      values[GL.STENCIL_BACK_VALUE_MASK]
    ),
  stencilOpFront: (gl, values) =>
    gl.stencilOpSeparate(
      GL.FRONT,
      values[GL.STENCIL_FAIL],
      values[GL.STENCIL_PASS_DEPTH_FAIL],
      values[GL.STENCIL_PASS_DEPTH_PASS]
    ),
  stencilOpBack: (gl, values) =>
    gl.stencilOpSeparate(
      GL.BACK,
      values[GL.STENCIL_BACK_FAIL],
      values[GL.STENCIL_BACK_PASS_DEPTH_FAIL],
      values[GL.STENCIL_BACK_PASS_DEPTH_PASS]
    )
};

// GETTER TABLE - FOR READING OUT AN ENTIRE CONTEXT

const isEnabled = (gl, key) => gl.isEnabled(key);

// Exceptions for any keys that cannot be queried by gl.getParameters
export const GL_PARAMETER_GETTERS = {
  [GL.BLEND]: isEnabled,
  [GL.CULL_FACE]: isEnabled,
  [GL.DEPTH_TEST]: isEnabled,
  [GL.DITHER]: isEnabled,
  [GL.POLYGON_OFFSET_FILL]: isEnabled,
  [GL.SAMPLE_ALPHA_TO_COVERAGE]: isEnabled,
  [GL.SAMPLE_COVERAGE]: isEnabled,
  [GL.SCISSOR_TEST]: isEnabled,
  [GL.STENCIL_TEST]: isEnabled,

  // WebGL 2
  [GL.RASTERIZER_DISCARD]: isEnabled
};

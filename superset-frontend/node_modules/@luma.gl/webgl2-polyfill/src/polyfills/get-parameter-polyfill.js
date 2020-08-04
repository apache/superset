/* eslint-disable no-inline-comments, max-len, camelcase */
import GL from '@luma.gl/constants';

const OES_element_index = 'OES_element_index';
const WEBGL_draw_buffers = 'WEBGL_draw_buffers';
const EXT_disjoint_timer_query = 'EXT_disjoint_timer_query';
const EXT_disjoint_timer_query_webgl2 = 'EXT_disjoint_timer_query_webgl2';
const EXT_texture_filter_anisotropic = 'EXT_texture_filter_anisotropic';
const WEBGL_debug_renderer_info = 'WEBGL_debug_renderer_info';

const GL_FRAGMENT_SHADER_DERIVATIVE_HINT = 0x8b8b;
const GL_DONT_CARE = 0x1100;
const GL_GPU_DISJOINT_EXT = 0x8fbb;
const GL_MAX_TEXTURE_MAX_ANISOTROPY_EXT = 0x84ff;
const GL_UNMASKED_VENDOR_WEBGL = 0x9245; // vendor string of the graphics driver.
const GL_UNMASKED_RENDERER_WEBGL = 0x9246; // renderer string of the graphics driver.

const getWebGL2ValueOrZero = gl => (!isWebGL2(gl) ? 0 : undefined);

// if a function returns undefined in this table,
// the original getParameter will be called, defeating the override
const WEBGL_PARAMETERS = {
  [GL.READ_BUFFER]: gl => (!isWebGL2(gl) ? GL.COLOR_ATTACHMENT0 : undefined),

  // WebGL2 context parameters
  [GL_FRAGMENT_SHADER_DERIVATIVE_HINT]: gl => (!isWebGL2(gl) ? GL_DONT_CARE : undefined),

  [GL.RASTERIZER_DISCARD]: getWebGL2ValueOrZero,

  [GL.SAMPLES]: getWebGL2ValueOrZero,

  // WebGL2 extension context parameters
  [GL_GPU_DISJOINT_EXT]: (gl, getParameter) => {
    const ext = isWebGL2(gl)
      ? gl.getExtension(EXT_disjoint_timer_query_webgl2)
      : gl.getExtension(EXT_disjoint_timer_query);
    return ext && ext.GPU_DISJOINT_EXT ? getParameter(ext.GPU_DISJOINT_EXT) : 0;
  },

  // Extension fixed values
  [GL_UNMASKED_VENDOR_WEBGL]: (gl, getParameter) => {
    const ext = gl.getExtension(WEBGL_debug_renderer_info);
    return getParameter((ext && ext.UNMASKED_VENDOR_WEBGL) || GL.VENDOR);
  },

  [GL_UNMASKED_RENDERER_WEBGL]: (gl, getParameter) => {
    const ext = gl.getExtension(WEBGL_debug_renderer_info);
    return getParameter((ext && ext.UNMASKED_RENDERER_WEBGL) || GL.RENDERER);
  },

  // Extension LIMITS
  [GL_MAX_TEXTURE_MAX_ANISOTROPY_EXT]: (gl, getParameter) => {
    const ext = gl.luma.extensions[EXT_texture_filter_anisotropic];
    return ext ? getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1.0;
  },

  // WebGL2 Limits
  [GL.MAX_3D_TEXTURE_SIZE]: getWebGL2ValueOrZero,
  [GL.MAX_ARRAY_TEXTURE_LAYERS]: getWebGL2ValueOrZero,
  [GL.MAX_CLIENT_WAIT_TIMEOUT_WEBGL]: getWebGL2ValueOrZero,
  [GL.MAX_COLOR_ATTACHMENTS]: (gl, getParameter) => {
    if (!isWebGL2(gl)) {
      const ext = gl.getExtension(WEBGL_draw_buffers);
      return ext ? getParameter(ext.MAX_COLOR_ATTACHMENTS_WEBGL) : 0;
    }
    return undefined;
  },
  [GL.MAX_COMBINED_FRAGMENT_UNIFORM_COMPONENTS]: getWebGL2ValueOrZero,
  [GL.MAX_COMBINED_UNIFORM_BLOCKS]: getWebGL2ValueOrZero,
  [GL.MAX_COMBINED_VERTEX_UNIFORM_COMPONENTS]: getWebGL2ValueOrZero,
  [GL.MAX_DRAW_BUFFERS]: gl => {
    if (!isWebGL2(gl)) {
      const ext = gl.getExtension(WEBGL_draw_buffers);
      return ext ? ext.MAX_DRAW_BUFFERS_WEBGL : 0;
    }
    return undefined;
  },
  [GL.MAX_ELEMENT_INDEX]:
    // Guess: per webglstats.com 99.6% of webgl2 supports 2147483647
    gl => (gl.getExtension(OES_element_index) ? 2147483647 : 65535),
  [GL.MAX_ELEMENTS_INDICES]:
    // Guess: "Reasonably safe" per webglstats.com - could be higher/lower (on some mobile devices)
    gl => (gl.getExtension(OES_element_index) ? 16777216 : 65535),
  [GL.MAX_ELEMENTS_VERTICES]:
    // Guess: "Reasonably safe" per webglstats.com - could be higher/lower (on some mobile devices)
    gl => 16777216,
  [GL.MAX_FRAGMENT_INPUT_COMPONENTS]: getWebGL2ValueOrZero,
  [GL.MAX_FRAGMENT_UNIFORM_BLOCKS]: getWebGL2ValueOrZero,
  [GL.MAX_FRAGMENT_UNIFORM_COMPONENTS]: getWebGL2ValueOrZero,
  [GL.MAX_SAMPLES]: getWebGL2ValueOrZero,
  [GL.MAX_SERVER_WAIT_TIMEOUT]: getWebGL2ValueOrZero,
  [GL.MAX_TEXTURE_LOD_BIAS]: getWebGL2ValueOrZero,
  [GL.MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS]: getWebGL2ValueOrZero,
  [GL.MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS]: getWebGL2ValueOrZero,
  [GL.MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS]: getWebGL2ValueOrZero,
  [GL.MAX_UNIFORM_BLOCK_SIZE]: getWebGL2ValueOrZero,
  [GL.MAX_UNIFORM_BUFFER_BINDINGS]: getWebGL2ValueOrZero,
  [GL.MAX_VARYING_COMPONENTS]: getWebGL2ValueOrZero,
  [GL.MAX_VERTEX_OUTPUT_COMPONENTS]: getWebGL2ValueOrZero,
  [GL.MAX_VERTEX_UNIFORM_BLOCKS]: getWebGL2ValueOrZero,
  [GL.MAX_VERTEX_UNIFORM_COMPONENTS]: getWebGL2ValueOrZero,
  [GL.MIN_PROGRAM_TEXEL_OFFSET]: getWebGL2ValueOrZero,
  [GL.MAX_PROGRAM_TEXEL_OFFSET]: getWebGL2ValueOrZero,
  [GL.UNIFORM_BUFFER_OFFSET_ALIGNMENT]: getWebGL2ValueOrZero
};

// Return true if WebGL2 context
function isWebGL2(gl) {
  return Boolean(gl && gl._version === 2);
}

// A "replacement" gl.getParameter that accepts "enums" from extensions and WebGL2
// and returns reasonably safe defaults
export function getParameterPolyfill(gl, originalGetParameter, pname) {
  // Return mock limits (usually 0) for WebGL2 constants to ensure these
  // can be queries without error
  const limit = WEBGL_PARAMETERS[pname];
  const value = typeof limit === 'function' ? limit(gl, originalGetParameter, pname) : limit;
  const result = value !== undefined ? value : originalGetParameter(pname);
  return result;
}

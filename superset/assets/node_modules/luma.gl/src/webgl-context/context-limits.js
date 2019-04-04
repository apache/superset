/* eslint-disable no-inline-comments, max-len */
import GL from '../constants';
import {isWebGL2} from '../webgl-utils';

const WEBGL_LIMITS = {
  [GL.ALIASED_LINE_WIDTH_RANGE]: {gl1: new Float32Array([1, 1])},
  [GL.ALIASED_POINT_SIZE_RANGE]: {gl1: new Float32Array([1, 1])},
  [GL.MAX_TEXTURE_SIZE]: {gl1: 64, gl2: 2048}, // GLint
  [GL.MAX_CUBE_MAP_TEXTURE_SIZE]: {gl1: 16}, // GLint
  [GL.MAX_TEXTURE_IMAGE_UNITS]: {gl1: 8}, // GLint
  [GL.MAX_COMBINED_TEXTURE_IMAGE_UNITS]: {gl1: 8}, // GLint
  [GL.MAX_VERTEX_TEXTURE_IMAGE_UNITS]: {gl1: 0}, // GLint
  [GL.MAX_RENDERBUFFER_SIZE]: {gl1: 1}, // GLint
  [GL.MAX_VARYING_VECTORS]: {gl1: 8}, // GLint
  [GL.MAX_VERTEX_ATTRIBS]: {gl1: 8}, // GLint
  [GL.MAX_VERTEX_UNIFORM_VECTORS]: {gl1: 128}, // GLint
  [GL.MAX_FRAGMENT_UNIFORM_VECTORS]: {gl1: 16}, // GLint
  [GL.MAX_VIEWPORT_DIMS]: {gl1: new Int32Array([0, 0])},

  // Extensions
  // [GL.MAX_TEXTURE_MAX_ANISOTROPY_EXT]: {gl1: 1.0, extension: 'EXT_texture_filter_anisotropic'},

  // WebGL2 Limits
  [GL.MAX_3D_TEXTURE_SIZE]: {gl1: 0, gl2: 256}, //  GLint
  [GL.MAX_ARRAY_TEXTURE_LAYERS]: {gl1: 0, gl2: 256}, // GLint
  [GL.MAX_CLIENT_WAIT_TIMEOUT_WEBGL]: {gl1: 0, gl2: 0}, //  GLint64
  [GL.MAX_COLOR_ATTACHMENTS]: {gl1: 0, gl2: 4}, //  GLint
  [GL.MAX_COMBINED_FRAGMENT_UNIFORM_COMPONENTS]: {gl1: 0, gl2: 0}, // GLint64
  [GL.MAX_COMBINED_UNIFORM_BLOCKS]: {gl1: 0, gl2: 0}, //  GLint
  [GL.MAX_COMBINED_VERTEX_UNIFORM_COMPONENTS]: {gl1: 0, gl2: 0}, // GLint64
  [GL.MAX_DRAW_BUFFERS]: {gl1: 0, gl2: 4}, // GLint
  [GL.MAX_ELEMENT_INDEX]: {gl1: 0, gl2: 0}, //  GLint64
  [GL.MAX_ELEMENTS_INDICES]: {gl1: 0, gl2: 0}, // GLint
  [GL.MAX_ELEMENTS_VERTICES]: {gl1: 0, gl2: 0}, //  GLint
  [GL.MAX_FRAGMENT_INPUT_COMPONENTS]: {gl1: 0, gl2: 0}, //  GLint
  [GL.MAX_FRAGMENT_UNIFORM_BLOCKS]: {gl1: 0, gl2: 0}, //  GLint
  [GL.MAX_FRAGMENT_UNIFORM_COMPONENTS]: {gl1: 0, gl2: 0}, //  GLint
  [GL.MAX_SAMPLES]: {gl1: 0, gl2: 0}, //  GLint
  [GL.MAX_SERVER_WAIT_TIMEOUT]: {gl1: 0, gl2: 0}, //  GLint64
  [GL.MAX_TEXTURE_LOD_BIAS]: {gl1: 0, gl2: 0}, // GLfloat
  [GL.MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS]: {gl1: 0, gl2: 0}, //  GLint
  [GL.MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS]: {gl1: 0, gl2: 0}, //  GLint
  [GL.MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS]: {gl1: 0, gl2: 0}, // GLint
  [GL.MAX_UNIFORM_BLOCK_SIZE]: {gl1: 0, gl2: 0}, // GLint64
  [GL.MAX_UNIFORM_BUFFER_BINDINGS]: {gl1: 0, gl2: 0}, //  GLint
  [GL.MAX_VARYING_COMPONENTS]: {gl1: 0, gl2: 0}, // GLint
  [GL.MAX_VERTEX_OUTPUT_COMPONENTS]: {gl1: 0, gl2: 0}, // GLint
  [GL.MAX_VERTEX_UNIFORM_BLOCKS]: {gl1: 0, gl2: 0}, //  GLint
  [GL.MAX_VERTEX_UNIFORM_COMPONENTS]: {gl1: 0, gl2: 0}, //  GLint
  [GL.MIN_PROGRAM_TEXEL_OFFSET]: {gl1: 0, gl2: -8, negative: true}, // GLint
  [GL.MAX_PROGRAM_TEXEL_OFFSET]: {gl1: 0, gl2: 7}, // GLint
  [GL.UNIFORM_BUFFER_OFFSET_ALIGNMENT]: {gl1: 0, gl2: 0} // GLint
};

export function getContextLimits(gl) {
  gl.luma = gl.luma || {};

  if (!gl.luma.limits) {
    gl.luma.limits = {};
    gl.luma.webgl1MinLimits = {};
    gl.luma.webgl2MinLimits = {};

    const isWebgl2 = isWebGL2(gl);

    // WEBGL limits
    for (const parameter in WEBGL_LIMITS) {
      const limit = WEBGL_LIMITS[parameter];

      const webgl1MinLimit = limit.gl1;
      const webgl2MinLimit = 'gl2' in limit ? limit.gl2 : limit.gl1;
      const minLimit = isWebgl2 ? webgl2MinLimit : webgl1MinLimit;

      // Check if we can query for this limit
      const limitNotAvailable =
        ('gl2' in limit && !isWebgl2) ||
        ('extension' in limit && !gl.getExtension(limit.extension));

      const value = limitNotAvailable ? minLimit : gl.getParameter(parameter);
      gl.luma.limits[parameter] = value;
      gl.luma.webgl1MinLimits[parameter] = webgl1MinLimit;
      gl.luma.webgl2MinLimits[parameter] = webgl2MinLimit;
    }
  }

  return gl.luma.limits;
}

export function getGLContextInfo(gl) {
  gl.luma = gl.luma || {};

  if (!gl.luma.info) {
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    gl.luma.info = {
      [GL.VENDOR]: gl.getParameter(GL.VENDOR),
      [GL.RENDERER]: gl.getParameter(GL.RENDERER),
      [GL.UNMASKED_VENDOR_WEBGL]:
        gl.getParameter((info && info.UNMASKED_VENDOR_WEBGL) || GL.VENDOR),
      [GL.UNMASKED_RENDERER_WEBGL]:
        gl.getParameter((info && info.UNMASKED_RENDERER_WEBGL) || GL.RENDERER),
      [GL.VERSION]: gl.getParameter(GL.VERSION),
      [GL.SHADING_LANGUAGE_VERSION]: gl.getParameter(GL.SHADING_LANGUAGE_VERSION)
    };
  }

  return gl.luma.info;
}

const GL_UNMASKED_VENDOR_WEBGL = 0x9245; // vendor string of the graphics driver.
const GL_UNMASKED_RENDERER_WEBGL = 0x9246; // renderer string of the graphics driver.

export function getGLContextInfo2(gl) {
  const vendorMasked = gl.getParameter(GL.VENDOR);
  const rendererMasked = gl.getParameter(GL.RENDERER);
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const vendorUnmasked = ext && gl.getParameter(ext.UNMASKED_VENDOR_WEBGL || GL.VENDOR);
  const rendererUnmasked = ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL || GL.RENDERER);
  return {
    vendor: vendorUnmasked || vendorMasked,
    renderer: rendererUnmasked || rendererMasked,
    vendorMasked,
    rendererMasked,
    version: gl.getParameter(GL.VERSION),
    shadingLanguageVersion: gl.getParameter(GL.SHADING_LANGUAGE_VERSION)
  };
}

export function getContextInfo(gl) {
  const limits = getContextLimits(gl);
  const info = getGLContextInfo(gl);
  return {
    // basic information
    vendor: info[GL_UNMASKED_VENDOR_WEBGL] || info[GL.VENDOR],
    renderer: info[GL_UNMASKED_RENDERER_WEBGL] || info[GL.RENDERER],
    version: info[GL.VERSION],
    shadingLanguageVersion: info[GL.SHADING_LANGUAGE_VERSION],
    // info, caps and limits
    info,
    limits,
    webgl1MinLimits: gl.luma.webgl1MinLimits,
    webgl2MinLimits: gl.luma.webgl2MinLimits
  };
}

// DEBUG INFO

/**
 * Provides strings identifying the GPU vendor and driver.
 * https://www.khronos.org/registry/webgl/extensions/WEBGL_debug_renderer_info/
 * @param {WebGLRenderingContext} gl - context
 * @return {Object} - 'vendor' and 'renderer' string fields.
 */
export function glGetDebugInfo(gl) {
  return getGLContextInfo2(gl);
  // const info = gl.getExtension('WEBGL_debug_renderer_info');
  // // We can't determine if 'WEBGL_debug_renderer_info' is supported by
  // // checking whether info is null here. Firefox doesn't follow the
  // // specs by returning null for unsupported extension. Instead,
  // // it returns an object without GL_UNMASKED_VENDOR_WEBGL and GL_UNMASKED_RENDERER_WEBGL.
  // return {
  //   vendor: (info && info.UNMASKED_VENDOR_WEBGL) ?
  //     gl.getParameter(info.UNMASKED_VENDOR_WEBGL) : 'unknown',
  //   renderer: (info && info.UNMASKED_RENDERER_WEBGL) ?
  //     gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown'
  // };
}

export const TEST_EXPORTS = {
  WEBGL_LIMITS
};

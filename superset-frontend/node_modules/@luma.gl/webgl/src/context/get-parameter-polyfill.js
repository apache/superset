// A major polyfill of "gl.getParameter"
// Attempts to return sane values for extension constants
// TODO - Move WebGL2 polyfills into webgl2-polyfill module
/* eslint-disable camelcase */
import GL from '@luma.gl/constants';
import {isWebGL2} from '../webgl-utils';

const WEBGL_debug_renderer_info = 'WEBGL_debug_renderer_info';
const EXT_disjoint_timer_query = 'EXT_disjoint_timer_query';
const EXT_disjoint_timer_query_webgl2 = 'EXT_disjoint_timer_query_webgl2';
const EXT_texture_filter_anisotropic = 'EXT_texture_filter_anisotropic';

// eslint-disable-next-line complexity
export function getParameter(gl, originalFunc, pname) {
  const GL_UNMASKED_VENDOR_WEBGL = 0x9245; // vendor string of the graphics driver.
  const GL_UNMASKED_RENDERER_WEBGL = 0x9246; // renderer string of the graphics driver.

  const GL_MAX_TEXTURE_MAX_ANISOTROPY_EXT = 0x84ff;

  const GL_FRAGMENT_SHADER_DERIVATIVE_HINT = 0x8b8b;
  const GL_DONT_CARE = 0x1100;
  const GL_GPU_DISJOINT_EXT = 0x8fbb;

  const {extensions} = gl.luma;

  const info = gl.getExtension(WEBGL_debug_renderer_info);

  switch (pname) {
    // EXTENSIONS SOMETIMES DO NOT USE THE OFFICIAL CONSTANTS.
    case GL_UNMASKED_VENDOR_WEBGL:
      return originalFunc((info && info.UNMASKED_VENDOR_WEBGL) || GL.VENDOR);
    case GL_UNMASKED_RENDERER_WEBGL:
      return originalFunc((info && info.UNMASKED_RENDERER_WEBGL) || GL.RENDERER);

    case GL_FRAGMENT_SHADER_DERIVATIVE_HINT:
      return !isWebGL2(gl) ? GL_DONT_CARE : undefined;

    case GL_GPU_DISJOINT_EXT:
      const hasTimerQueries =
        !extensions[EXT_disjoint_timer_query] && !extensions[EXT_disjoint_timer_query_webgl2];
      return hasTimerQueries ? 0 : undefined;

    case GL_MAX_TEXTURE_MAX_ANISOTROPY_EXT:
      const ext = gl.luma.extensions[EXT_texture_filter_anisotropic];
      pname = ext && ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT;
      return !pname ? 1.0 : undefined;

    default:
      return undefined;
  }
}

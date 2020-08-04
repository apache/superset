import GL from '@luma.gl/constants';
import assert from './assert';

import {getParameterPolyfill} from './polyfills/get-parameter-polyfill';

const OES_vertex_array_object = 'OES_vertex_array_object';
const ANGLE_instanced_arrays = 'ANGLE_instanced_arrays';
const WEBGL_draw_buffers = 'WEBGL_draw_buffers';
const EXT_disjoint_timer_query = 'EXT_disjoint_timer_query';
const EXT_texture_filter_anisotropic = 'EXT_texture_filter_anisotropic';

const ERR_VAO_NOT_SUPPORTED = 'VertexArray requires WebGL2 or OES_vertex_array_object extension';

// Return true if WebGL2 context
function isWebGL2(gl) {
  return Boolean(gl && gl._version === 2);
}

// Return object with webgl2 flag and an extension
function getExtensionData(gl, extension) {
  return {
    webgl2: isWebGL2(gl),
    ext: gl.getExtension(extension)
  };
}

// function mapExtensionConstant(gl, constant) {
//   switch (constant) {
//   case ext.FRAGMENT_SHADER_DERIVATIVE_HINT_OES: return GL.FRAGMENT_SHADER_DERIVATIVE_HINT;
//   }
// }

export const WEBGL2_CONTEXT_POLYFILLS = {
  // POLYFILL TABLE
  [OES_vertex_array_object]: {
    meta: {suffix: 'OES'},
    // NEW METHODS
    createVertexArray: () => {
      assert(false, ERR_VAO_NOT_SUPPORTED);
    },
    deleteVertexArray: () => {},
    bindVertexArray: () => {},
    isVertexArray: () => false
  },
  [ANGLE_instanced_arrays]: {
    meta: {
      suffix: 'ANGLE'
      // constants: {
      //   VERTEX_ATTRIB_ARRAY_DIVISOR: 'VERTEX_ATTRIB_ARRAY_DIVISOR_ANGLE'
      // }
    },
    vertexAttribDivisor(location, divisor) {
      // Accept divisor 0 even if instancing is not supported (0 = no instancing)
      assert(divisor === 0, 'WebGL instanced rendering not supported');
    },
    drawElementsInstanced: () => {},
    drawArraysInstanced: () => {}
  },
  [WEBGL_draw_buffers]: {
    meta: {
      suffix: 'WEBGL'
    },
    drawBuffers: () => {
      assert(false);
    }
  },
  [EXT_disjoint_timer_query]: {
    meta: {suffix: 'EXT'},
    // WebGL1: Polyfills the WebGL2 Query API
    createQuery: () => {
      assert(false);
    },
    deleteQuery: () => {
      assert(false);
    },
    beginQuery: () => {
      assert(false);
    },
    endQuery: () => {},
    getQuery(handle, pname) {
      return this.getQueryObject(handle, pname);
    },
    // The WebGL1 extension uses getQueryObject rather then getQueryParameter
    getQueryParameter(handle, pname) {
      return this.getQueryObject(handle, pname);
    },
    getQueryObject: () => {}
  }
};

export const WEBGL2_CONTEXT_OVERRIDES = {
  // Ensure readBuffer is a no-op
  readBuffer: (gl, originalFunc, attachment) => {
    if (isWebGL2(gl)) {
      originalFunc(attachment);
    } else {
      // assert(attachment !== GL_COLOR_ATTACHMENT0 && attachment !== GL_FRONT);
    }
  },
  // Override for getVertexAttrib that returns sane values for non-WebGL1 constants
  getVertexAttrib: (gl, originalFunc, location, pname) => {
    // const gl = this; // eslint-disable-line
    const {webgl2, ext} = getExtensionData(gl, ANGLE_instanced_arrays);

    let result;
    switch (pname) {
      // WebGL1 attributes will never be integer
      case GL.VERTEX_ATTRIB_ARRAY_INTEGER:
        result = !webgl2 ? false : undefined;
        break;
      // if instancing is not available, return 0 meaning divisor has not been set
      case GL.VERTEX_ATTRIB_ARRAY_DIVISOR:
        result = !webgl2 && !ext ? 0 : undefined;
        break;
      default:
    }

    return result !== undefined ? result : originalFunc(location, pname);
  },
  // Handle transform feedback and uniform block queries in WebGL1
  getProgramParameter: (gl, originalFunc, program, pname) => {
    if (!isWebGL2(gl)) {
      switch (pname) {
        case GL.TRANSFORM_FEEDBACK_BUFFER_MODE:
          return GL.SEPARATE_ATTRIBS;
        case GL.TRANSFORM_FEEDBACK_VARYINGS:
          return 0;
        case GL.ACTIVE_UNIFORM_BLOCKS:
          return 0;
        default:
      }
    }
    return originalFunc(program, pname);
  },
  getInternalformatParameter: (gl, originalFunc, target, format, pname) => {
    if (!isWebGL2(gl)) {
      switch (pname) {
        case GL.SAMPLES:
          return new Int32Array([0]);
        default:
      }
    }
    return gl.getInternalformatParameter(target, format, pname);
  },
  getTexParameter(gl, originalFunc, target, pname) {
    switch (pname) {
      case GL.TEXTURE_MAX_ANISOTROPY_EXT:
        const {extensions} = gl.luma;
        const ext = extensions[EXT_texture_filter_anisotropic];
        pname = (ext && ext.TEXTURE_MAX_ANISOTROPY_EXT) || GL.TEXTURE_MAX_ANISOTROPY_EXT;
        break;
      default:
    }
    return originalFunc(target, pname);
  },
  getParameter: getParameterPolyfill,
  hint(gl, originalFunc, pname, value) {
    // TODO - handle GL.FRAGMENT_SHADER_DERIVATIVE_HINT:
    // switch (pname) {
    // case GL.FRAGMENT_SHADER_DERIVATIVE_HINT:
    // }
    return originalFunc(pname, value);
  }
};

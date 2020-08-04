import GL from '@luma.gl/constants';
import {isWebGL2} from '../webgl-utils';

// const S3TC = 'WEBGL_compressed_texture_s3tc';
// const PVRTC = 'WEBGL_compressed_texture_pvrtc';
// const ES3 = 'WEBGL_compressed_texture_es3';
// const ETC1 = 'WEBGL_compressed_texture_etc1';
// const SRGB = 'EXT_sRGB';
// const DEPTH = 'WEBGL_depth_texture';

// Legal combinations for internalFormat, format and type
export const TEXTURE_FORMATS = {
  // Unsized texture format - more performance
  [GL.RGB]: {dataFormat: GL.RGB, types: [GL.UNSIGNED_BYTE, GL.UNSIGNED_SHORT_5_6_5]},
  // TODO: format: GL.RGBA type: GL.FLOAT is supported in WebGL1 when 'OES_texure_float' is suported
  // we need to update this table structure to specify extensions (gl1: 'OES_texure_float', gl2: false) for each type.
  [GL.RGBA]: {
    dataFormat: GL.RGBA,
    types: [GL.UNSIGNED_BYTE, GL.UNSIGNED_SHORT_4_4_4_4, GL.UNSIGNED_SHORT_5_5_5_1]
  },
  [GL.ALPHA]: {dataFormat: GL.ALPHA, types: [GL.UNSIGNED_BYTE]},
  [GL.LUMINANCE]: {dataFormat: GL.LUMINANCE, types: [GL.UNSIGNED_BYTE]},
  [GL.LUMINANCE_ALPHA]: {dataFormat: GL.LUMINANCE_ALPHA, types: [GL.UNSIGNED_BYTE]},

  // 32 bit floats
  [GL.R32F]: {dataFormat: GL.RED, types: [GL.FLOAT], gl2: true},
  [GL.RG32F]: {dataFormat: GL.RG, types: [GL.FLOAT], gl2: true},
  [GL.RGB32F]: {dataFormat: GL.RGB, types: [GL.FLOAT], gl2: true},
  [GL.RGBA32F]: {dataFormat: GL.RGBA, types: [GL.FLOAT], gl2: true}

  // [GL.DEPTH_COMPONENT]: {types: [GL.UNSIGNED_SHORT, GL.UNSIGNED_INT, GL.UNSIGNED_INT_24_8], gl1: DEPTH},
  // [GL.DEPTH_STENCIL]: {gl1: DEPTH},

  // Sized texture format - more performance
  // R
  // [GL.R8]: {dataFormat: GL.RED, types: [GL.UNSIGNED_BYTE], gl2: true},
  // [GL.R16F]: {dataFormat: GL.RED, types: [GL.HALF_FLOAT, GL.FLOAT], gl2: true},
  // [GL.R8UI]: {dataFormat: GL.RED_INTEGER, types: [GL.UNSIGNED_BYTE], gl2: true},
  // // RG
  // [GL.RG8]: {dataFormat: GL.RG, types: [GL.UNSIGNED_BYTE], gl2: true},
  // [GL.RG16F]: {dataFormat: GL.RG, types: [GL.HALF_FLOAT, GL.FLOAT], gl2: true},
  // [GL.RG8UI]: {dataFormat: GL.RG_INTEGER, types: [GL.UNSIGNED_BYTE], gl2: true},
  // // RGB
  // [GL.RGB8]: {dataFormat: GL.RGB, types: [GL.UNSIGNED_BYTE], gl2: true, gl1: SRGB},
  // [GL.SRGB8]: {dataFormat: GL.RGB, types: [GL.UNSIGNED_BYTE], gl2: true, gl1: SRGB},
  // [GL.RGB565]: {dataFormat: GL.RGB, types: [GL.UNSIGNED_BYTE, GL.UNSIGNED_SHORT_5_6_5], gl2: true},
  // [GL.R11F_G11F_B10F]: {dataFormat: GL.RGB, types: [GL.UNSIGNED_INT_10F_11F_11F_REV, GL.HALF_FLOAT, GL.FLOAT], gl2: true},
  // [GL.RGB9_E5]: {dataFormat: GL.RGB, types: [GL.HALF_FLOAT, GL.FLOAT], gl2: true, gl1: 'WEBGL_color_buffer_half_float'},
  // [GL.RGB16F]: {dataFormat: GL.RGB, types: [GL.HALF_FLOAT, GL.FLOAT], gl2: true, gl1: 'WEBGL_color_buffer_float'},
  // [GL.RGB8UI]: {dataFormat: GL.RGB_INTEGER, types: [GL.UNSIGNED_BYTE], gl2: true},
  // // RGBA
  // [GL.RGBA8]: {dataFormat: GL.RGBA, types: [GL.UNSIGNED_BYTE], gl2: true, gl1: SRGB},
  // [GL.SRGB8_ALPHA8]: {dataFormat: GL.RGBA, types: [GL.UNSIGNED_BYTE], gl2: true, gl1: SRGB},
  // [GL.RGB5_A1]: {dataFormat: GL.RGBA, types: [GL.UNSIGNED_BYTE, GL.UNSIGNED_SHORT_5_5_5_1], gl2: true},
  // [GL.RGBA4]: {dataFormat: GL.RGBA, types: [GL.UNSIGNED_BYTE, GL.UNSIGNED_SHORT_4_4_4_4], gl2: true},
  // [GL.RGBA16F]: {dataFormat: GL.RGBA, types: [GL.HALF_FLOAT, GL.FLOAT], gl2: true},
  // [GL.RGBA8UI]: {dataFormat: GL.RGBA_INTEGER, types: [GL.UNSIGNED_BYTE], gl2: true}

  // Compressed formats

  // WEBGL_compressed_texture_s3tc

  // [GL.COMPRESSED_RGB_S3TC_DXT1_EXT]: {compressed: true, gl1: S3TC},
  // [GL.COMPRESSED_RGBA_S3TC_DXT1_EXT]: {compressed: true, gl1: S3TC},
  // [GL.COMPRESSED_RGBA_S3TC_DXT3_EXT]: {compressed: true, gl1: S3TC},
  // [GL.COMPRESSED_RGBA_S3TC_DXT5_EXT]: {compressed: true, gl1: S3TC},

  // WEBGL_compressed_texture_es3

  // [GL.COMPRESSED_R11_EAC]: {compressed: true, gl1: ES3}, // RED
  // [GL.COMPRESSED_SIGNED_R11_EAC]: {compressed: true, gl1: ES3}, // RED
  // [GL.COMPRESSED_RG11_EAC]: {compressed: true, gl1: ES3}, // RG
  // [GL.COMPRESSED_SIGNED_RG11_EAC]: {compressed: true, gl1: ES3}, // RG
  // [GL.COMPRESSED_RGB8_ETC2]: {compressed: true, gl1: ES3}, // RGB
  // [GL.COMPRESSED_RGBA8_ETC2_EAC]: {compressed: true, gl1: ES3}, // RBG
  // [GL.COMPRESSED_SRGB8_ETC2]: {compressed: true, gl1: ES3}, // RGB
  // [GL.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC]: {compressed: true, gl1: ES3}, // RGBA
  // [GL.COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2]: {compressed: true, gl1: ES3}, // RGBA
  // [GL.COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2]: {compressed: true, gl1: ES3}, // RGBA
  /* WebGL2 guaranteed availability compressed formats?
  COMPRESSED_R11_EAC RED
  COMPRESSED_SIGNED_R11_EAC RED
  COMPRESSED_RG11_EAC RG
  COMPRESSED_SIGNED_RG11_EAC RG
  COMPRESSED_RGB8_ETC2 RGB
  COMPRESSED_SRGB8_ETC2 RGB
  COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2 RGBA
  COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2 RGBA
  COMPRESSED_RGBA8_ETC2_EAC RGBA
  COMPRESSED_SRGB8_ALPHA8_ETC2_EAC
  */

  // WEBGL_compressed_texture_pvrtc

  // [GL.COMPRESSED_RGB_PVRTC_4BPPV1_IMG]: {compressed: true, gl1: PVRTC},
  // [GL.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG]: {compressed: true, gl1: PVRTC},
  // [GL.COMPRESSED_RGB_PVRTC_2BPPV1_IMG]: {compressed: true, gl1: PVRTC},
  // [GL.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG]: {compressed: true, gl1: PVRTC},

  // WEBGL_compressed_texture_etc1

  // [GL.COMPRESSED_RGB_ETC1_WEBGL]: {compressed: true, gl1: ETC1},

  // WEBGL_compressed_texture_atc

  // [GL.COMPRESSED_RGB_ATC_WEBGL]: {compressed: true, gl1: ETC1},
  // [GL.COMPRESSED_RGBA_ATC_EXPLICIT_ALPHA_WEBGL]: {compressed: true, gl1: ETC1},
  // [GL.COMPRESSED_RGBA_ATC_INTERPOLATED_ALPHA_WEBGL]: {compressed: true, gl1: ETC1}
};

export const DATA_FORMAT_CHANNELS = {
  [GL.RED]: 1,
  [GL.RED_INTEGER]: 1,
  [GL.RG]: 2,
  [GL.RG_INTEGER]: 2,
  [GL.RGB]: 3,
  [GL.RGB_INTEGER]: 3,
  [GL.RGBA]: 4,
  [GL.RGBA_INTEGER]: 4,
  [GL.DEPTH_COMPONENT]: 1,
  [GL.DEPTH_STENCIL]: 1,
  [GL.ALPHA]: 1,
  [GL.LUMINANCE]: 1,
  [GL.LUMINANCE_ALPHA]: 2
};

export const TYPE_SIZES = {
  [GL.FLOAT]: 4,
  [GL.UNSIGNED_INT]: 4,
  [GL.INT]: 4,
  [GL.UNSIGNED_SHORT]: 2,
  [GL.SHORT]: 2,
  [GL.HALF_FLOAT]: 2,
  [GL.BYTE]: 1,
  [GL.UNSIGNED_BYTE]: 1
};

export function isFormatSupported(gl, format) {
  const info = TEXTURE_FORMATS[format];
  if (!info) {
    return false;
  }
  if (info.gl1 === undefined && info.gl2 === undefined) {
    // No info - always supported
    return true;
  }
  const value = isWebGL2(gl) ? info.gl2 || info.gl1 : info.gl1;
  return typeof value === 'string' ? gl.getExtension(value) : value;
}

export function isLinearFilteringSupported(gl, format) {
  const info = TEXTURE_FORMATS[format];
  switch (info && info.types[0]) {
    // Both WebGL1 and WebGL2?
    case GL.FLOAT:
      return gl.getExtension('OES_texture_float_linear');
    // Not in WebGL2?
    case GL.HALF_FLOAT:
      return gl.getExtension('OES_texture_half_float_linear');
    default:
      return true;
  }
}

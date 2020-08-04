import GL from '@luma.gl/constants';

// Define local extension strings to optimize minification
// const SRGB = 'EXT_sRGB';
// const EXT_FLOAT_WEBGL1 = 'WEBGL.color_buffer_float';
const EXT_FLOAT_WEBGL2 = 'EXT_color_buffer_float';
// const EXT_HALF_FLOAT_WEBGL1 = 'EXT_color_buffer_half_float';

// NOTE(Tarek): bpp === "bytes per pixel", used for
// memory usage calculations.
export default {
  [GL.DEPTH_COMPONENT16]: {bpp: 2}, // 16 depth bits.
  [GL.DEPTH_COMPONENT24]: {gl2: true, bpp: 3},
  [GL.DEPTH_COMPONENT32F]: {gl2: true, bpp: 4},

  [GL.STENCIL_INDEX8]: {bpp: 1}, // 8 stencil bits.

  [GL.DEPTH_STENCIL]: {bpp: 4},
  [GL.DEPTH24_STENCIL8]: {gl2: true, bpp: 4},
  [GL.DEPTH32F_STENCIL8]: {gl2: true, bpp: 5},

  // When using a WebGL 1 context, color renderbuffer formats are limited
  [GL.RGBA4]: {bpp: 2},
  [GL.RGB565]: {bpp: 2},
  [GL.RGB5_A1]: {bpp: 2},

  // When using a WebGL 2 context, the following values are available additionally:
  [GL.R8]: {gl2: true, bpp: 1},
  [GL.R8UI]: {gl2: true, bpp: 1},
  [GL.R8I]: {gl2: true, bpp: 1},
  [GL.R16UI]: {gl2: true, bpp: 2},
  [GL.R16I]: {gl2: true, bpp: 2},
  [GL.R32UI]: {gl2: true, bpp: 4},
  [GL.R32I]: {gl2: true, bpp: 4},
  [GL.RG8]: {gl2: true, bpp: 2},
  [GL.RG8UI]: {gl2: true, bpp: 2},
  [GL.RG8I]: {gl2: true, bpp: 2},
  [GL.RG16UI]: {gl2: true, bpp: 4},
  [GL.RG16I]: {gl2: true, bpp: 4},
  [GL.RG32UI]: {gl2: true, bpp: 8},
  [GL.RG32I]: {gl2: true, bpp: 8},
  [GL.RGB8]: {gl2: true, bpp: 3},
  [GL.RGBA8]: {gl2: true, bpp: 4},
  // [GL.SRGB8_ALPHA8]: {gl2: true, gl1: SRGB}, // When using the EXT_sRGB WebGL1 extension
  [GL.RGB10_A2]: {gl2: true, bpp: 4},
  [GL.RGBA8UI]: {gl2: true, bpp: 4},
  [GL.RGBA8I]: {gl2: true, bpp: 4},
  [GL.RGB10_A2UI]: {gl2: true, bpp: 4},
  [GL.RGBA16UI]: {gl2: true, bpp: 8},
  [GL.RGBA16I]: {gl2: true, bpp: 8},
  [GL.RGBA32I]: {gl2: true, bpp: 16},
  [GL.RGBA32UI]: {gl2: true, bpp: 16},

  // When using a WebGL 2 context and the EXT_color_buffer_float WebGL2 extension
  [GL.R16F]: {gl2: EXT_FLOAT_WEBGL2, bpp: 2},
  [GL.RG16F]: {gl2: EXT_FLOAT_WEBGL2, bpp: 4},
  [GL.RGBA16F]: {gl2: EXT_FLOAT_WEBGL2, bpp: 8},
  [GL.R32F]: {gl2: EXT_FLOAT_WEBGL2, bpp: 4},
  [GL.RG32F]: {gl2: EXT_FLOAT_WEBGL2, bpp: 8},
  // TODO - can't get WEBGL.color_buffer_float to work on renderbuffers
  [GL.RGBA32F]: {gl2: EXT_FLOAT_WEBGL2, bpp: 16},
  // [GL.RGBA32F]: {gl2: EXT_FLOAT_WEBGL2, gl1: EXT_FLOAT_WEBGL1},
  [GL.R11F_G11F_B10F]: {gl2: EXT_FLOAT_WEBGL2, bpp: 4}
};

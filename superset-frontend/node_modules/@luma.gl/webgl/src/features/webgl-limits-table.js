import GL from '@luma.gl/constants';

export default {
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

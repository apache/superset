import Framebuffer from '../classes/framebuffer';
import Texture2D from '../classes/texture-2d';
// TODO - this should be the default export, test cases need updating
export const FEATURES = {
  WEBGL2: 'WEBGL2',

  // API SUPPORT
  VERTEX_ARRAY_OBJECT: 'VERTEX_ARRAY_OBJECT',
  TIMER_QUERY: 'TIMER_QUERY',
  INSTANCED_RENDERING: 'INSTANCED_RENDERING',
  MULTIPLE_RENDER_TARGETS: 'MULTIPLE_RENDER_TARGETS',

  // FEATURES
  ELEMENT_INDEX_UINT32: 'ELEMENT_INDEX_UINT32',

  // BLENDING
  BLEND_EQUATION_MINMAX: 'BLEND_EQUATION_MINMAX',
  FLOAT_BLEND: 'FLOAT_BLEND',

  // TEXTURES: '// TEXTURES', RENDERBUFFERS
  COLOR_ENCODING_SRGB: 'COLOR_ENCODING_SRGB',

  // TEXTURES
  TEXTURE_DEPTH: 'TEXTURE_DEPTH',
  TEXTURE_FLOAT: 'TEXTURE_FLOAT',
  TEXTURE_HALF_FLOAT: 'TEXTURE_HALF_FLOAT',

  TEXTURE_FILTER_LINEAR_FLOAT: 'TEXTURE_FILTER_LINEAR_FLOAT',
  TEXTURE_FILTER_LINEAR_HALF_FLOAT: 'TEXTURE_FILTER_LINEAR_HALF_FLOAT',
  TEXTURE_FILTER_ANISOTROPIC: 'TEXTURE_FILTER_ANISOTROPIC',

  // FRAMEBUFFERS: '// FRAMEBUFFERS', TEXTURES AND RENDERBUFFERS
  COLOR_ATTACHMENT_RGBA32F: 'COLOR_ATTACHMENT_RGBA32F',
  COLOR_ATTACHMENT_FLOAT: 'COLOR_ATTACHMENT_FLOAT',
  COLOR_ATTACHMENT_HALF_FLOAT: 'COLOR_ATTACHMENT_HALF_FLOAT',

  // GLSL extensions
  GLSL_FRAG_DATA: 'GLSL_FRAG_DATA',
  GLSL_FRAG_DEPTH: 'GLSL_FRAG_DEPTH',
  GLSL_DERIVATIVES: 'GLSL_DERIVATIVES',
  GLSL_TEXTURE_LOD: 'GLSL_TEXTURE_LOD'
};

// TODO: remove this global (https://github.com/uber/luma.gl/issues/1258)
let float32ColorAttachmentSupport = null;

// function to test if Float 32 bit format texture can be bound as color attachment
function checkFloat32ColorAttachment(gl) {
  // if previously queried, return the cache value.
  if (float32ColorAttachmentSupport !== null) {
    return float32ColorAttachmentSupport;
  }
  const testTexture = new Texture2D(gl, {
    format: gl.RGBA,
    type: gl.FLOAT,
    dataFormat: gl.RGBA
  });
  const testFb = new Framebuffer(gl, {
    id: `test-framebuffer`,
    check: false,
    attachments: {
      [gl.COLOR_ATTACHMENT0]: testTexture
    }
  });
  const status = testFb.getStatus();
  testTexture.delete();
  testFb.delete();
  float32ColorAttachmentSupport = status === gl.FRAMEBUFFER_COMPLETE;
  return float32ColorAttachmentSupport;
}

// Defines luma.gl "feature" names and semantics
// Format: 'feature-name: [WebGL1 support, WebGL2 support] / [WebGL1 and WebGL2 support]', when support is 'string' it is the name of the extension
export default {
  [FEATURES.WEBGL2]: [false, true],

  // API SUPPORT
  [FEATURES.VERTEX_ARRAY_OBJECT]: ['OES_vertex_array_object', true],
  [FEATURES.TIMER_QUERY]: ['EXT_disjoint_timer_query', 'EXT_disjoint_timer_query_webgl2'],
  [FEATURES.INSTANCED_RENDERING]: ['ANGLE_instanced_arrays', true],
  [FEATURES.MULTIPLE_RENDER_TARGETS]: ['WEBGL_draw_buffers', true],

  // FEATURES
  [FEATURES.ELEMENT_INDEX_UINT32]: ['OES_element_index_uint', true],

  // BLENDING
  [FEATURES.BLEND_EQUATION_MINMAX]: ['EXT_blend_minmax', true],
  [FEATURES.FLOAT_BLEND]: ['EXT_float_blend'],

  // TEXTURES, RENDERBUFFERS
  [FEATURES.COLOR_ENCODING_SRGB]: ['EXT_sRGB', true],

  // TEXTURES
  [FEATURES.TEXTURE_DEPTH]: ['WEBGL_depth_texture', true],
  [FEATURES.TEXTURE_FLOAT]: ['OES_texture_float', true],
  [FEATURES.TEXTURE_HALF_FLOAT]: ['OES_texture_half_float', true],

  [FEATURES.TEXTURE_FILTER_LINEAR_FLOAT]: ['OES_texture_float_linear'],
  [FEATURES.TEXTURE_FILTER_LINEAR_HALF_FLOAT]: ['OES_texture_half_float_linear'],
  [FEATURES.TEXTURE_FILTER_ANISOTROPIC]: ['EXT_texture_filter_anisotropic'],

  // FRAMEBUFFERS, TEXTURES AND RENDERBUFFERS
  [FEATURES.COLOR_ATTACHMENT_RGBA32F]: [checkFloat32ColorAttachment, 'EXT_color_buffer_float'],
  [FEATURES.COLOR_ATTACHMENT_FLOAT]: [false, 'EXT_color_buffer_float'],
  [FEATURES.COLOR_ATTACHMENT_HALF_FLOAT]: ['EXT_color_buffer_half_float'],

  // GLSL extensions
  [FEATURES.GLSL_FRAG_DATA]: ['WEBGL_draw_buffers', true],
  [FEATURES.GLSL_FRAG_DEPTH]: ['EXT_frag_depth', true],
  [FEATURES.GLSL_DERIVATIVES]: ['OES_standard_derivatives', true],
  [FEATURES.GLSL_TEXTURE_LOD]: ['EXT_shader_texture_lod', true]
};

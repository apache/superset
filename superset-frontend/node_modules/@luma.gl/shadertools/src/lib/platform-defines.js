import {getContextInfo, hasFeatures, canCompileGLGSExtension, FEATURES} from '../utils/webgl-info';

export function getPlatformShaderDefines(gl) {
  const debugInfo = getContextInfo(gl);

  switch (debugInfo.gpuVendor.toLowerCase()) {
    case 'nvidia':
      return `\
#define NVIDIA_GPU
// Nvidia optimizes away the calculation necessary for emulated fp64
#define LUMA_FP64_CODE_ELIMINATION_WORKAROUND 1
`;

    case 'intel':
      return `\
#define INTEL_GPU
// Intel optimizes away the calculation necessary for emulated fp64
#define LUMA_FP64_CODE_ELIMINATION_WORKAROUND 1
// Intel's built-in 'tan' function doesn't have acceptable precision
#define LUMA_FP32_TAN_PRECISION_WORKAROUND 1
// Intel GPU doesn't have full 32 bits precision in same cases, causes overflow
#define LUMA_FP64_HIGH_BITS_OVERFLOW_WORKAROUND 1
`;

    case 'amd':
      // AMD Does not eliminate fp64 code
      return `\
#define AMD_GPU
`;

    default:
      // We don't know what GPU it is, could be that the GPU driver or
      // browser is not implementing UNMASKED_RENDERER constant and not
      // reporting a correct name
      return `\
#define DEFAULT_GPU
// Prevent driver from optimizing away the calculation necessary for emulated fp64
#define LUMA_FP64_CODE_ELIMINATION_WORKAROUND 1
// Intel's built-in 'tan' function doesn't have acceptable precision
#define LUMA_FP32_TAN_PRECISION_WORKAROUND 1
// Intel GPU doesn't have full 32 bits precision in same cases, causes overflow
#define LUMA_FP64_HIGH_BITS_OVERFLOW_WORKAROUND 1
`;
  }
}

export function getVersionDefines(gl, glslVersion, isFragment) {
  // Add shadertools defines to let shaders portably v1/v3 check for features
  let versionDefines = `\
#if (__VERSION__ > 120)

# define FRAG_DEPTH
# define DERIVATIVES
# define DRAW_BUFFERS
# define TEXTURE_LOD

#endif // __VERSION
`;

  if (hasFeatures(gl, FEATURES.GLSL_FRAG_DEPTH)) {
    versionDefines += `\
// FRAG_DEPTH => gl_FragDepth is available
#ifdef GL_EXT_frag_depth
#extension GL_EXT_frag_depth : enable
# define FRAG_DEPTH
# define gl_FragDepth gl_FragDepthEXT
#endif
`;
  }
  if (
    hasFeatures(gl, FEATURES.GLSL_DERIVATIVES) &&
    canCompileGLGSExtension(gl, FEATURES.GLSL_DERIVATIVES)
  ) {
    versionDefines += `\
// DERIVATIVES => dxdF, dxdY and fwidth are available
#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
# define DERIVATIVES
#endif
`;
  }
  if (
    hasFeatures(gl, FEATURES.GLSL_FRAG_DATA) &&
    canCompileGLGSExtension(gl, FEATURES.GLSL_FRAG_DATA, {behavior: 'require'})
  ) {
    versionDefines += `\
// DRAW_BUFFERS => gl_FragData[] is available
#ifdef GL_EXT_draw_buffers
#extension GL_EXT_draw_buffers : require
#define DRAW_BUFFERS
#endif
`;
  }
  if (hasFeatures(gl, FEATURES.GLSL_TEXTURE_LOD)) {
    versionDefines += `\
// TEXTURE_LOD => texture2DLod etc are available
#ifdef GL_EXT_shader_texture_lod
#extension GL_EXT_shader_texture_lod : enable
# define TEXTURE_LOD
#define texture2DLod texture2DLodEXT
#define texture2DProjLod texture2DProjLodEXT
#define texture2DProjLod texture2DProjLodEXT
#define textureCubeLod textureCubeLodEXT
#define texture2DGrad texture2DGradEXT
#define texture2DProjGrad texture2DProjGradEXT
#define texture2DProjGrad texture2DProjGradEXT
#define textureCubeGrad textureCubeGradEXT
#endif
`;
  }
  return versionDefines;
}

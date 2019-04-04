// Exports WebGL API constants and types, plus some basic type checks
export {
  Image,
  WebGLRenderingContext,
  WebGLProgram,
  WebGLShader,
  WebGLBuffer,
  WebGLFramebuffer,
  WebGLRenderbuffer,
  WebGLTexture,
  WebGLUniformLocation,
  WebGLActiveInfo,
  WebGLShaderPrecisionFormat,
  WebGL2RenderingContext,

  webGLTypesAvailable
} from './webgl-types';

export {
  isWebGL,
  isWebGL2,
  assertWebGLContext,
  assertWebGL2Context
} from './webgl-checks';

export {
  requestAnimationFrame,
  cancelAnimationFrame
} from './request-animation-frame';

export {default as formatGLSLCompilerError, parseGLSLCompilerError} from './format-glsl-error';
export {default as getShaderName} from './get-shader-name';

export {
  getGLTypeFromTypedArray, getTypedArrayFromGLType, flipRows, scalePixels
} from './typed-array-utils';

export {getKeyValue, getKey, getKeyType} from '../webgl-utils/constants-to-keys';

// TODO - avoid uncondsitionally importing GL as it adds a lot to bundle size?
export {default as GL} from '../constants';

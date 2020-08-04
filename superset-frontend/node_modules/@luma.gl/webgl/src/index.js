// luma.gl Base WebGL wrapper library
// Provides simple class/function wrappers around the low level webgl objects
// These classes are intentionally close to the WebGL API
// but make it easier to use.
// Higher level abstractions can be built on these classes

// Initialize any global state
export {lumaStats} from './init';

// TODO - should we reexport these?
export {
  resetParameters,
  getParameter,
  getParameters,
  setParameter,
  setParameters,
  withParameters,
  getModifiedParameters
} from '@luma.gl/webgl-state-tracker';

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
} from './webgl-utils/webgl-types';

export {
  createGLContext,
  destroyGLContext,
  resizeGLContext,
  instrumentGLContext,
  setGLContextDefaults
} from './context/context';

export {getCanvas, getPageLoadPromise} from './context/create-canvas';

// UTILS
export {requestAnimationFrame, cancelAnimationFrame} from './webgl-utils/request-animation-frame';

// WebGL Functions
export {isWebGL, isWebGL2} from './webgl-utils/webgl-checks';
export {cloneTextureFrom} from './webgl-utils/texture-utils';
export {getKeyValue, getKey} from './webgl-utils/constants-to-keys';
export {getContextInfo, getGLContextInfo, getContextLimits} from './features/limits';
export {getContextDebugInfo} from './debug/get-context-debug-info';
export {FEATURES} from './features/webgl-features-table';
export {hasFeature, hasFeatures, getFeatures} from './features/features';
export {default as canCompileGLGSExtension} from './features/check-glsl-extension';

// WebGL Helper Classes
export {default as Accessor} from './classes/accessor';

// WebGL1 classes
export {default as Buffer} from './classes/buffer';
export {Shader, VertexShader, FragmentShader} from './classes/shader';
export {default as Program} from './classes/program';
export {default as Framebuffer} from './classes/framebuffer';
export {default as Renderbuffer} from './classes/renderbuffer';
export {default as Texture2D} from './classes/texture-2d';
export {default as TextureCube} from './classes/texture-cube';

export {clear, clearBuffer} from './classes/clear';

// Copy and Blit
export {
  readPixelsToArray,
  readPixelsToBuffer,
  copyToDataUrl,
  copyToImage,
  copyToTexture,
  blit
} from './classes/copy-and-blit';

// WebGL2 classes & Extensions
export {default as Query} from './classes/query';
export {default as Texture3D} from './classes/texture-3d';
export {default as TransformFeedback} from './classes/transform-feedback';
export {default as VertexArrayObject} from './classes/vertex-array-object';
export {default as VertexArray} from './classes/vertex-array';
export {default as UniformBufferLayout} from './classes/uniform-buffer-layout';

// experimental WebGL exports

export {setPathPrefix, loadFile, loadImage} from './utils/load-file';

// PARSE SHADER SOURCE
export {default as getShaderName} from './glsl-utils/get-shader-name';
export {default as getShaderVersion} from './glsl-utils/get-shader-version';

// UTILS
export {default as log} from './utils/log';
export {default as assert} from './utils/assert';
export {uid, isObjectEmpty} from './utils/utils';
export {self, window, global, document} from './utils/globals';
export {default as isBrowser} from './utils/is-browser';
export {cssToDeviceRatio, cssToDevicePixels} from './utils/device-pixels';

// INTERNAL
export {parseUniformName, getUniformSetter} from './classes/uniforms';
export {getDebugTableForUniforms} from './debug/debug-uniforms';
export {getDebugTableForVertexArray} from './debug/debug-vertex-array';
export {getDebugTableForProgramConfiguration} from './debug/debug-program-configuration';

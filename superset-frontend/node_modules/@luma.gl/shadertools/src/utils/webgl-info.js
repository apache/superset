// Feature detection for WebGL
//
// Provides a function that enables simple checking of which WebGL features are
// available in an WebGL1 or WebGL2 environment.

/* eslint-disable no-inline-comments, max-len */
import isOldIE from './is-old-ie';
import assert from './assert';

const GL_VENDOR = 0x1f00;
const GL_RENDERER = 0x1f01;
const GL_VERSION = 0x1f02;
const GL_SHADING_LANGUAGE_VERSION = 0x8b8c;

// Defines luma.gl "feature" names and semantics
const WEBGL_FEATURES = {
  // GLSL extensions
  GLSL_FRAG_DATA: ['WEBGL_draw_buffers', true], // TODO - name makes no sense in GLSL 3.00
  GLSL_FRAG_DEPTH: ['EXT_frag_depth', true],
  GLSL_DERIVATIVES: ['OES_standard_derivatives', true],
  GLSL_TEXTURE_LOD: ['EXT_shader_texture_lod', true]
};

// Create a key-mirrored FEATURES array
const FEATURES = {};
Object.keys(WEBGL_FEATURES).forEach(key => {
  FEATURES[key] = key;
});

export {FEATURES};

function isWebGL2(gl) {
  return Boolean(gl && gl._version === 2);
}

export function getContextInfo(gl) {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const vendor = gl.getParameter((info && info.UNMASKED_VENDOR_WEBGL) || GL_VENDOR);
  const renderer = gl.getParameter((info && info.UNMASKED_RENDERER_WEBGL) || GL_RENDERER);
  const gpuVendor = identifyGPUVendor(vendor, renderer);
  const gpuInfo = {
    gpuVendor,
    vendor,
    renderer,
    version: gl.getParameter(GL_VERSION),
    shadingLanguageVersion: gl.getParameter(GL_SHADING_LANGUAGE_VERSION)
  };
  return gpuInfo;
}

function identifyGPUVendor(vendor, renderer) {
  if (vendor.match(/NVIDIA/i) || renderer.match(/NVIDIA/i)) {
    return 'NVIDIA';
  }
  if (vendor.match(/INTEL/i) || renderer.match(/INTEL/i)) {
    return 'INTEL';
  }
  if (
    vendor.match(/AMD/i) ||
    renderer.match(/AMD/i) ||
    vendor.match(/ATI/i) ||
    renderer.match(/ATI/i)
  ) {
    return 'AMD';
  }
  return 'UNKNOWN GPU';
}

const compiledGlslExtensions = {};

// Enables feature detection in IE11 due to a bug where gl.getExtension may return true
// but fail to compile when the extension is enabled in the shader. Specifically,
// the OES_standard_derivatives and WEBGL_draw_buffers extensions fails to compile in IE11 even though its included
// in the list of supported extensions.
// opts allows user agent to be overridden for testing
/*
* Inputs :
*  gl : WebGL context
*  cap : Key of WEBGL_FEATURES object identifying the extension
*  opts :
*   behavior : behavor of extension to be tested, by defualt `enable` is used
* Returns : true, if shader is compiled successfully, false otherwise
*/
export function canCompileGLGSExtension(gl, cap, opts = {}) {
  const feature = WEBGL_FEATURES[cap];
  assert(feature, cap);

  if (!isOldIE(opts)) {
    return true;
  }

  if (cap in compiledGlslExtensions) {
    return compiledGlslExtensions[cap];
  }

  const extensionName = feature[0];
  const behavior = opts.behavior || 'enable';
  const source = `#extension GL_${extensionName} : ${behavior}\nvoid main(void) {}`;

  const shader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const canCompile = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  gl.deleteShader(shader);
  compiledGlslExtensions[cap] = canCompile;
  return canCompile;
}

// TODO - cache the value
function getFeature(gl, cap) {
  const feature = WEBGL_FEATURES[cap];
  assert(feature, cap);

  // Get extension name from table
  const extensionName = isWebGL2(gl) ? feature[1] || feature[0] : feature[0];

  // Check if the value is dependent on checking an extension
  const value =
    typeof extensionName === 'string' ? Boolean(gl.getExtension(extensionName)) : extensionName;

  assert(value === false || value === true);

  return value;
}

export function hasFeatures(gl, features) {
  features = Array.isArray(features) ? features : [features];
  return features.every(feature => getFeature(gl, feature));
}

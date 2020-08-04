import isOldIE from './check-old-ie';
import WEBGL_FEATURES from './webgl-features-table';
import {assert} from '../utils';

// Enables feature detection in IE11 due to a bug where gl.getExtension may return true
// but fail to compile when the extension is enabled in the shader. Specifically,
// the OES_standard_derivatives extension fails to compile in IE11 even though its included
// in the list of supported extensions.
const compiledGlslExtensions = {};

// options allows user agent to be overridden for testing
export default function canCompileGLGSExtension(gl, cap, options = {}) {
  const feature = WEBGL_FEATURES[cap];
  assert(feature, cap);

  if (!isOldIE(options)) {
    return true;
  }

  if (cap in compiledGlslExtensions) {
    return compiledGlslExtensions[cap];
  }

  const extensionName = feature[0];
  const source = `#extension GL_${extensionName} : enable\nvoid main(void) {}`;

  const shader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const canCompile = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  gl.deleteShader(shader);
  compiledGlslExtensions[cap] = canCompile;
  return canCompile;
}

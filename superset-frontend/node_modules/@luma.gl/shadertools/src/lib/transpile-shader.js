// Transpiles shader source code to target GLSL version
// Note: We always run transpiler even if same version e.g. 3.00 => 3.00
// RFC: https://github.com/uber/luma.gl/blob/7.0-release/dev-docs/RFCs/v6.0/portable-glsl-300-rfc.md
export default function transpileShader(source, targetGLSLVersion, isVertex) {
  switch (targetGLSLVersion) {
    case 300:
      return isVertex ? convertVertexShaderTo300(source) : convertFragmentShaderTo300(source);
    case 100:
      return isVertex ? convertVertexShaderTo100(source) : convertFragmentShaderTo100(source);
    default:
      throw new Error(`unknown GLSL version ${targetGLSLVersion}`);
  }
}

function convertVertexShaderTo300(source) {
  return source
    .replace(/attribute\s+/g, 'in ')
    .replace(/varying\s+/g, 'out ')
    .replace(/texture2D\(/g, 'texture(')
    .replace(/textureCube\(+/g, 'texture(')
    .replace(/texture2DLodEXT\(/g, 'textureLod(')
    .replace(/textureCubeLodEXT\(/g, 'textureLod(');
}

function convertFragmentShaderTo300(source) {
  return source
    .replace(/varying\s+/g, 'in ')
    .replace(/texture2D\(/g, 'texture(')
    .replace(/textureCube\(/g, 'texture(')
    .replace(/texture2DLodEXT\(/g, 'textureLod(')
    .replace(/textureCubeLodEXT\(/g, 'textureLod(');

  // Deal with fragColor
  // .replace(/gl_fragColor/g, 'fragColor ');
}

function convertVertexShaderTo100(source) {
  // /gm - treats each line as a string, so that ^ matches after newlines
  return source
    .replace(/^in\s+/gm, 'attribute ')
    .replace(/^out\s+/gm, 'varying ')
    .replace(/texture\(/g, 'texture2D(');
}

function convertFragmentShaderTo100(source) {
  // /gm - treats each line as a string, so that ^ matches after newlines
  return source.replace(/^in\s+/gm, 'varying ').replace(/texture\(/g, 'texture2D(');

  // Deal with fragColor
  // .replace(/^out\s+/g, 'varying ')
}

// Supports GLSLIFY style naming of shaders
// #define SHADER_NAME ...
export default function getShaderName(shader, defaultName = 'unnamed') {
  const SHADER_NAME_REGEXP = /#define[\s*]SHADER_NAME[\s*]([A-Za-z0-9_-]+)[\s*]/;
  const match = shader.match(SHADER_NAME_REGEXP);
  return match ? match[1] : defaultName;
}

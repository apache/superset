// Minimal texture (diffuse map) support

/* eslint-disable camelcase */
const DEFAULT_MODULE_OPTIONS = {
  diffuseTexture: null,
  diffuseColor: [0.5, 0.5, 0.5, 1]
};

function getUniforms(opts = DEFAULT_MODULE_OPTIONS) {
  const uniforms = {};
  if (opts.diffuseTexture !== undefined) {
    uniforms.diffuse_uHasTexture = Boolean(opts.diffuseTexture);
    uniforms.diffuse_uTexture = opts.diffuseTexture;
  }
  if (opts.diffuseColor !== undefined) {
    uniforms.diffuse_uColor = opts.diffuseColor;
  }
  return uniforms;
}

const vs = `\
out vec2 diffuse_vTexCoord;

/* Set the UV coordinate from attributes */
void diffuse_setTextureCoordinate(vec2 uv) {
  diffuse_vTexCoord = uv;
}
`;

const fs = `\
uniform vec4 diffuse_uColor;
uniform bool diffuse_uHasTexture;
uniform sampler2D diffuse_uTexture;

in vec2 diffuse_vTexCoord;

// Gets diffuse color of material from uniform
// If we have a standard (diffuse) texture, set color to texture
// return (vec4) - rgba
//
vec4 diffuse_getColor() {
  vec2 texCoord = diffuse_vTexCoord;
  return diffuse_uHasTexture ?
    texture2D(diffuse_uTexture, vec2(texCoord.s, texCoord.t)) :
    diffuse_uColor;
}

vec4 diffuse_filterColor(vec4 color) {
  return diffuse_getColor();
}
`;

export default {
  name: 'diffuse',
  getUniforms,
  vs,
  fs
};

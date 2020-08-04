export default `\
precision highp float;

#define SHADER_NAME luma-default-fs

varying vec4 vColor;
varying vec2 vTexCoord;
varying vec3 lightWeighting;

uniform bool hasTexture1;
uniform sampler2D sampler1;

uniform bool enablePicking;
uniform vec3 pickColor;

uniform bool hasFog;
uniform vec3 fogColor;

uniform float fogNear;
uniform float fogFar;

void main() {
  if(!hasTexture1) {
    gl_FragColor = vec4(vColor.rgb * lightWeighting, vColor.a);
  } else {
    gl_FragColor =
      vec4(texture2D(sampler1, vec2(vTexCoord.s, vTexCoord.t)).rgb * lightWeighting, 1.0);
  }

  if (enablePicking) {
    gl_FragColor = vec4(pickColor, 1.0);
  }

  /* handle fog */
  if (hasFog) {
    float depth = gl_FragCoord.z / gl_FragCoord.w;
    float fogFactor = smoothstep(fogNear, fogFar, depth);
    gl_FragColor = mix(gl_FragColor, vec4(fogColor, gl_FragColor.w), fogFactor);
  }
}
`;

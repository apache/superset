export default `
#define SHADER_NAME simple-mesh-layer-fs

// Note(Tarek): headless-gl supports derivatives, but doesn't report it via getExtension. Awesome!
#ifdef DERIVATIVES
#define FLAT_SHADE_NORMAL normalize(cross(dFdx(position_commonspace.xyz), dFdy(position_commonspace.xyz)))
#else
#define FLAT_SHADE_NORMAL vec3(0.0, 0.0, 1.0)
#endif

precision highp float;

uniform bool hasTexture;
uniform sampler2D sampler;
uniform vec4 color;
uniform bool flatShading;

varying vec2 vTexCoord;
varying vec3 cameraPosition;
varying vec3 normals_commonspace;
varying vec4 position_commonspace;
varying vec4 vColor;

void main(void) {
  vec3 normal;
  if (flatShading) {
    normal = FLAT_SHADE_NORMAL;
  } else {
    normal = normals_commonspace;
  }

  vec4 color = hasTexture ? texture2D(sampler, vTexCoord) : vColor / 255.;
  vec3 lightColor = lighting_getLightColor(color.rgb * 255., cameraPosition, position_commonspace.xyz, normal);
  gl_FragColor = vec4(lightColor / 255., color.a);

  // use highlight color if this fragment belongs to the selected object.
  gl_FragColor = picking_filterHighlightColor(gl_FragColor);

  // use picking color if rendering to picking FBO.
  gl_FragColor = picking_filterPickingColor(gl_FragColor);
}
`;

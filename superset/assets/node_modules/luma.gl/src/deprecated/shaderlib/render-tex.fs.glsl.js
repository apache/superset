export default `\
#define SHADER_NAME luma-render-tex-fs

#ifdef GL_ES
precision highp float;
#endif

#define LIGHT_MAX 4

varying vec2 vTexCoord1;
varying vec2 vTexCoord2;
varying vec2 vTexCoord3;
varying vec4 vColor;
varying vec4 vTransformedNormal;
varying vec4 vPosition;

uniform float shininess;
uniform bool enableSpecularHighlights;

uniform vec3 ambientColor;
uniform vec3 directionalColor;
uniform vec3 lightingDirection;

uniform vec3 pointLocation[LIGHT_MAX];
uniform vec3 pointColor[LIGHT_MAX];
uniform vec3 pointSpecularColor[LIGHT_MAX];
uniform int numberPoints;

uniform vec3 materialAmbientColor;
uniform vec3 materialDiffuseColor;
uniform vec3 materialSpecularColor;
uniform vec3 materialEmissiveColor;

uniform bool hasTexture1;
uniform sampler2D sampler1;

uniform mat4 viewMatrix;

void main(void) {
  vec3 ambientLightWeighting = ambientColor;

  vec3 lightDirection;
  float specularLightWeighting = 0.0;
  float diffuseLightWeighting = 0.0;
  vec3  specularLight = vec3(0.0, 0.0, 0.0);
  vec3  diffuseLight = vec3(0.0, 0.0, 0.0);

  vec3 transformedPointLocation;
  vec3 normal = vTransformedNormal.xyz;

  vec3 eyeDirection = normalize(-vPosition.xyz);
  vec3 reflectionDirection;

  for (int i = 0; i < LIGHT_MAX; i++) {
    if (i < numberPoints) {
      transformedPointLocation = (viewMatrix * vec4(pointLocation[i], 1.0)).xyz;
      lightDirection = normalize(transformedPointLocation - vPosition.xyz);

      if (enableSpecularHighlights) {
        reflectionDirection = reflect(-lightDirection, normal);
        specularLightWeighting = pow(max(dot(reflectionDirection, eyeDirection), 0.0), shininess);
        specularLight += specularLightWeighting * pointSpecularColor[i];
      }

      diffuseLightWeighting = max(dot(normal, lightDirection), 0.0);
      diffuseLight += diffuseLightWeighting * pointColor[i];
    } else {
        break;
    }
  }

  vec3 matAmbientColor = materialAmbientColor;
  vec3 matDiffuseColor = materialDiffuseColor;
  vec3 matSpecularColor = materialSpecularColor;
  vec3 matEmissiveColor = materialEmissiveColor;
  float alpha = 1.0;
  if (hasTexture1) {
    vec4 textureColor = texture2D(sampler1, vec2(vTexCoord1.s, vTexCoord1.t));
    matAmbientColor = matAmbientColor * textureColor.rgb;
    matDiffuseColor = matDiffuseColor * textureColor.rgb;
    matEmissiveColor = matEmissiveColor * textureColor.rgb;
    alpha = textureColor.a;
  }
  gl_FragColor = vec4(
    matAmbientColor * ambientLightWeighting
    + matDiffuseColor * diffuseLightWeighting
    + matSpecularColor * specularLightWeighting
    + matEmissiveColor,
    alpha
  );
}
`;

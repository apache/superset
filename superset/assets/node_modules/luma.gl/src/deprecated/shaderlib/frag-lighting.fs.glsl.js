export default `\
#define SHADER_NAME luma-frag-lighting-fs

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
uniform bool enableLights;

uniform vec3 ambientColor;
uniform vec3 directionalColor;
uniform vec3 lightingDirection;

uniform vec3 pointLocation[LIGHT_MAX];
uniform vec3 pointColor[LIGHT_MAX];
uniform vec3 pointSpecularColor[LIGHT_MAX];
uniform float enableSpecular[LIGHT_MAX];
uniform int numberPoints;

uniform bool hasTexture1;
uniform sampler2D sampler1;

uniform bool hasTexture2;
uniform sampler2D sampler2;

uniform bool hasTexture3;
uniform sampler2D sampler3;

uniform mat4 viewMatrix;

void main(void) {
  vec3 lightWeighting;
  if (!enableLights) {
    lightWeighting = vec3(1.0, 1.0, 1.0);
  } else {
    vec3 lightDirection;
    float specularLightWeighting = 0.0;
    float diffuseLightWeighting = 0.0;
    vec3  specularLight = vec3(0.0, 0.0, 0.0);
    vec3  diffuseLight = vec3(0.0, 0.0, 0.0);

    vec3 transformedPointLocation;
    vec3 normal = vTransformedNormal.xyz;

    vec3 eyeDirection = normalize(-vPosition.xyz);
    vec3 reflectionDirection;

    vec3 pointWeight = vec3(0.0, 0.0, 0.0);

    for (int i = 0; i < LIGHT_MAX; i++) {
      if (i < numberPoints) {
        transformedPointLocation = (viewMatrix * vec4(pointLocation[i], 1.0)).xyz;
        lightDirection = normalize(transformedPointLocation - vPosition.xyz);

        if (enableSpecular[i] > 0.0) {
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

    lightWeighting = ambientColor + diffuseLight + specularLight;
  }

  vec4 fragmentColor = vec4(0.0, 0.0, 0.0, 0.0);
  if (hasTexture1 || hasTexture2 || hasTexture3) {
    if (hasTexture1) {
      fragmentColor += texture2D(sampler1, vec2(vTexCoord1.s, vTexCoord1.t));
    }
    if (hasTexture2) {
      fragmentColor += texture2D(sampler2, vec2(vTexCoord2.s, vTexCoord2.t));
    }
    if (hasTexture3) {
      fragmentColor += texture2D(sampler3, vec2(vTexCoord3.s, vTexCoord3.t));
    }
  } else {
    fragmentColor = vColor;
  }
  gl_FragColor = vec4(fragmentColor.rgb * lightWeighting, fragmentColor.a);
}
`;

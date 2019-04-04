export default `\
#define LIGHT_MAX 4

/*
// lighting configuration
uniform bool enableLights;
uniform vec3 ambientColor;
uniform vec3 directionalColor;
uniform vec3 lightingDirection;

// point lights configuration
uniform vec3 pointLocation[LIGHT_MAX];
uniform vec3 pointColor[LIGHT_MAX];
uniform int numberPoints;

// reflection / refraction configuration
uniform bool useReflection;
*/

uniform bool lighting_uEnableLights;
uniform vec3 lighting_uAmbientColor;
uniform vec3 lighting_uDirection;
uniform vec3 lighting_uDirectionalColor;

// point lights configuration
uniform int  lighting_uPointCount;
uniform vec3 lighting_uPointLocation[LIGHT_MAX];
uniform vec3 lighting_uPointColor[LIGHT_MAX];

// reflection / refraction configuration
uniform bool lighting_uEnableReflections;

// varyings
varying vec4 lighting_vPosition;
varying vec4 lighting_vNormal;
varying vec3 lighting_vColor;
varying vec3 lighting_vLightWeighting;
varying vec3 lighting_vReflection;

void lighting_setPositionAndNormal(vec3 position, vec3 normal) {
  lighting_vPosition = worldMatrix * vec4(position, 1.);
  lighting_vNormal = worldInverseTransposeMatrix * vec4(normal, 1.);;
}

void lighting__getLightWeigting() {
  float directionalLightWeighting = max(dot(lighting_vNormal.xyz, lighting_uDirection), 0.);
  vec3 pointWeight = vec3(0., 0., 0.);
  for (int i = 0; i < LIGHT_MAX; i++) {
    if (i < numberPoints) {
      vec4 mvLightPosition = viewMatrix * vec4(lighting_uPointLocation[i], 1.);
      vec3 pointLightDirection = normalize(mvLightPosition.xyz - lighting_vPosition.xyz);
      pointWeight += max(dot(lighting_vNormal.xyz, pointLightDirection), 0.) * pointColor[i];
     } else {
       break;
     }
   }
   return ambientColor + (directionalColor * directionalLightWeighting) + pointWeight;
}

void lighting_apply(vec3 position, vec3 normal) {
  lighting_setPositionAndNormal(position, normal);

  // lighting code
  if(!lighting_uEnableLights) {
    lighting_vLightWeighting = vec3(1., 1., 1.);
  } else {
    lighting_vLightWeighting = lighting__getLightWeighting();
  }
}

void lighting_set_reflection(vec3 position) {
    // refraction / reflection code
  if (lighting_uEnableReflections) {
    lighting_vReflection = (viewInverseMatrix[3] - (worldMatrix * vec4(position, 1.))).xyz;
  } else {
    lighting_vReflection = vec3(1., 1., 1.);
  }
}
`;

export default `\
#ifdef GL_ES
precision highp float;
#endif

#define LIGHT_MAX 4

varying vec3 lighting_vLightWeighting;

vec4 lighting_apply(vec4 color) {
  // set color from texture
  return vec4(color.rgb * lighting_vLightWeighting, color.a);
}

// spec-map.fs

uniform mat4 viewMatrix;


varying vec4 lighting_vColor;
varying vec4 lighting_vTransformedNormal;
varying vec4 lighting_vPosition;

uniform float shininess;
uniform bool enableSpecularMap;
uniform bool enableLights;

uniform vec3 ambientColor;
uniform vec3 directionalColor;
uniform vec3 lightingDirection;

uniform vec3 lighting_uPointLocation[LIGHT_MAX];
uniform vec3 lighting_uPointColor[LIGHT_MAX];
uniform float lighting_uPointSpecularEnable[LIGHT_MAX];
uniform vec3 lighting_uPointSpecularColor[LIGHT_MAX];
uniform int numberPoints;


vec3 lighting__calculate_light_weighting() {
	return lighting__calculate_light_weighting(shininess);
}

vec3 lighting__calculate_light_weighting(shininess) {
  vec3 normal = vTransformedNormal.xyz;
  vec3 eyeDirection = normalize(-vPosition.xyz);

  vec3 specularLight = vec3(0., 0., 0.);
  vec3 diffuseLight = vec3(0., 0., 0.);

  for (int i = 0; i < LIGHT_MAX; i++) {
    if (i < numberPoints) {
      vec3 transformedPointLocation = (viewMatrix * vec4(lighting_uPointLocation[i], 1.0)).xyz;
      vec3 lightDirection = normalize(transformedPointLocation - vPosition.xyz);

      if (lighting_uPointSpecularEnable > 0.) {
        vec3 reflectionDirection = reflect(-lightDirection, normal);
        float specularLightWeighting =
          pow(max(dot(reflectionDirection, eyeDirection), 0.0), shininessVal);
        specularLight += specularLightWeighting * lighting_uPointSpecularColor[i];
      }

      float diffuseLightWeighting = max(dot(normal, lightDirection), 0.0);
      diffuseLight += diffuseLightWeighting * lighting_uPointColor[i];
    } else {
      break;
    }
  }

  return ambientColor + diffuseLight + specularLight;
}

void lighting_filterColor(fragmentColor) {
  if (!lighting_enable) {
  	return fragmentColor;
  } else {
  	vec3 lightWeighting = lighting__calculate_light_weighting();
  	return vec4(fragmentColor.rgb * lightWeighting, fragmentColor.a);
  }
}

// render-tex.fs

uniform vec3 material_uAmbientColor;
uniform vec3 material_uDiffuseColor;
uniform vec3 material_uSpecularColor;
uniform vec3 material_uEmissiveColor;

uniform bool hasTexture1;
uniform sampler2D sampler1;

uniform mat4 viewMatrix;

void apply_lighting(color) {
  vec3 ambientLightWeighting = ambientColor;

  vec3 normal = vTransformedNormal.xyz;
  vec3 eyeDirection = normalize(-vPosition.xyz);

  vec3 specularLight = vec3(0.0, 0.0, 0.0);
  vec3 diffuseLight = vec3(0.0, 0.0, 0.0);

  for (int i = 0; i < LIGHT_MAX; i++) {
    if (i < numberPoints) {
      vec3 transformedPointLocation = (viewMatrix * vec4(pointLocation[i], 1.0)).xyz;
      vec3 lightDirection = normalize(transformedPointLocation - vPosition.xyz);

      if (enableSpecularHighlights) {
        vec3 reflectionDirection = reflect(-lightDirection, normal);
        float specularLightWeighting =
          pow(max(dot(reflectionDirection, eyeDirection), 0.0), shininess);
        specularLight += specularLightWeighting * pointSpecularColor[i];
      }

      float diffuseLightWeighting = max(dot(normal, lightDirection), 0.0);
      diffuseLight += diffuseLightWeighting * pointColor[i];
    } else {
        break;
    }
  }

  vec3 matAmbientColor = material_uAmbientColor * color.rgb;
  vec3 matDiffuseColor = material_uDiffuseColor * color.rgb;
  vec3 matSpecularColor = material_uSpecularColor * color.rgb;
  vec3 matEmissiveColor = material_uEmissiveColor * color.rgb;
  gl_FragColor = vec4(
    matAmbientColor * ambientLightWeighting
    + matDiffuseColor * diffuseLightWeighting
    + matSpecularColor * specularLightWeighting
    + matEmissiveColor,
    color.a
  );
}

/// frag-lighting

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

// reflection / refraction configs
uniform float reflection;
uniform float refraction;

///
  // has cube texture then apply reflection
  // if (hasTextureCube1) {
  //   vec3 nReflection = normalize(vReflection);
  //   vec3 reflectionValue;
  //   if (refraction > 0.0) {
  //    reflectionValue = refract(nReflection, vNormal.xyz, refraction);
  //   } else {
  //    reflectionValue = -reflect(nReflection, vNormal.xyz);
  //   }

  //   // TODO(nico): check whether this is right.
  //   vec4 cubeColor = textureCube(samplerCube1,
  //       vec3(-reflectionValue.x, -reflectionValue.y, reflectionValue.z));
  //   gl_FragColor = vec4(mix(gl_FragColor.xyz, cubeColor.xyz, reflection), 1.0);
  // }
`;

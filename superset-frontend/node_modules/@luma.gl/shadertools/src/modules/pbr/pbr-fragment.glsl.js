// This fragment shader defines a reference implementation for Physically Based Shading of
// a microfacet surface material defined by a glTF model.
//
// Attribution:
// MIT license, Copyright (c) 2016-2017 Mohamad Moneimne and Contributors

export default `\
#if (__VERSION__ < 300)
#extension GL_EXT_shader_texture_lod: enable
#extension GL_OES_standard_derivatives : enable
#endif

// WebGL 1.0 does not support non-constant in for loops
// This provides an easy way to handle these cases
// and still take advantage of WebGL 2.0
#if (__VERSION__ < 300)
  #define SMART_FOR(INIT, WEBGL1COND, WEBGL2COND, INCR) for (INIT; WEBGL1COND; INCR)
#else
  #define SMART_FOR(INIT, WEBGL1COND, WEBGL2COND, INCR) for (INIT; WEBGL2COND; INCR)
#endif

precision highp float;

#ifdef USE_IBL
uniform samplerCube u_DiffuseEnvSampler;
uniform samplerCube u_SpecularEnvSampler;
uniform sampler2D u_brdfLUT;
uniform vec2 u_ScaleIBLAmbient;
#endif

#ifdef HAS_BASECOLORMAP
uniform sampler2D u_BaseColorSampler;
#endif
#ifdef HAS_NORMALMAP
uniform sampler2D u_NormalSampler;
uniform float u_NormalScale;
#endif
#ifdef HAS_EMISSIVEMAP
uniform sampler2D u_EmissiveSampler;
uniform vec3 u_EmissiveFactor;
#endif
#ifdef HAS_METALROUGHNESSMAP
uniform sampler2D u_MetallicRoughnessSampler;
#endif
#ifdef HAS_OCCLUSIONMAP
uniform sampler2D u_OcclusionSampler;
uniform float u_OcclusionStrength;
#endif

#ifdef ALPHA_CUTOFF
uniform float u_AlphaCutoff;
#endif

uniform vec2 u_MetallicRoughnessValues;
uniform vec4 u_BaseColorFactor;

uniform vec3 u_Camera;

// debugging flags used for shader output of intermediate PBR variables
#ifdef PBR_DEBUG
uniform vec4 u_ScaleDiffBaseMR;
uniform vec4 u_ScaleFGDSpec;
#endif

varying vec3 pbr_vPosition;

varying vec2 pbr_vUV;

#ifdef HAS_NORMALS
#ifdef HAS_TANGENTS
varying mat3 pbr_vTBN;
#else
varying vec3 pbr_vNormal;
#endif
#endif

// Encapsulate the various inputs used by the various functions in the shading equation
// We store values in this struct to simplify the integration of alternative implementations
// of the shading terms, outlined in the Readme.MD Appendix.
struct PBRInfo
{
  float NdotL;                  // cos angle between normal and light direction
  float NdotV;                  // cos angle between normal and view direction
  float NdotH;                  // cos angle between normal and half vector
  float LdotH;                  // cos angle between light direction and half vector
  float VdotH;                  // cos angle between view direction and half vector
  float perceptualRoughness;    // roughness value, as authored by the model creator (input to shader)
  float metalness;              // metallic value at the surface
  vec3 reflectance0;            // full reflectance color (normal incidence angle)
  vec3 reflectance90;           // reflectance color at grazing angle
  float alphaRoughness;         // roughness mapped to a more linear change in the roughness (proposed by [2])
  vec3 diffuseColor;            // color contribution from diffuse lighting
  vec3 specularColor;           // color contribution from specular lighting
  vec3 n;                       // normal at surface point
  vec3 v;                       // vector from surface point to camera
};

const float M_PI = 3.141592653589793;
const float c_MinRoughness = 0.04;

vec4 SRGBtoLINEAR(vec4 srgbIn)
{
#ifdef MANUAL_SRGB
#ifdef SRGB_FAST_APPROXIMATION
  vec3 linOut = pow(srgbIn.xyz,vec3(2.2));
#else //SRGB_FAST_APPROXIMATION
  vec3 bLess = step(vec3(0.04045),srgbIn.xyz);
  vec3 linOut = mix( srgbIn.xyz/vec3(12.92), pow((srgbIn.xyz+vec3(0.055))/vec3(1.055),vec3(2.4)), bLess );
#endif //SRGB_FAST_APPROXIMATION
  return vec4(linOut,srgbIn.w);;
#else //MANUAL_SRGB
  return srgbIn;
#endif //MANUAL_SRGB
}

// Find the normal for this fragment, pulling either from a predefined normal map
// or from the interpolated mesh normal and tangent attributes.
vec3 getNormal()
{
  // Retrieve the tangent space matrix
#ifndef HAS_TANGENTS
  vec3 pos_dx = dFdx(pbr_vPosition);
  vec3 pos_dy = dFdy(pbr_vPosition);
  vec3 tex_dx = dFdx(vec3(pbr_vUV, 0.0));
  vec3 tex_dy = dFdy(vec3(pbr_vUV, 0.0));
  vec3 t = (tex_dy.t * pos_dx - tex_dx.t * pos_dy) / (tex_dx.s * tex_dy.t - tex_dy.s * tex_dx.t);

#ifdef HAS_NORMALS
  vec3 ng = normalize(pbr_vNormal);
#else
  vec3 ng = cross(pos_dx, pos_dy);
#endif

  t = normalize(t - ng * dot(ng, t));
  vec3 b = normalize(cross(ng, t));
  mat3 tbn = mat3(t, b, ng);
#else // HAS_TANGENTS
  mat3 tbn = pbr_vTBN;
#endif

#ifdef HAS_NORMALMAP
  vec3 n = texture2D(u_NormalSampler, pbr_vUV).rgb;
  n = normalize(tbn * ((2.0 * n - 1.0) * vec3(u_NormalScale, u_NormalScale, 1.0)));
#else
  // The tbn matrix is linearly interpolated, so we need to re-normalize
  vec3 n = normalize(tbn[2].xyz);
#endif

  return n;
}

// Calculation of the lighting contribution from an optional Image Based Light source.
// Precomputed Environment Maps are required uniform inputs and are computed as outlined in [1].
// See our README.md on Environment Maps [3] for additional discussion.
#ifdef USE_IBL
vec3 getIBLContribution(PBRInfo pbrInputs, vec3 n, vec3 reflection)
{
  float mipCount = 9.0; // resolution of 512x512
  float lod = (pbrInputs.perceptualRoughness * mipCount);
  // retrieve a scale and bias to F0. See [1], Figure 3
  vec3 brdf = SRGBtoLINEAR(texture2D(u_brdfLUT,
    vec2(pbrInputs.NdotV, 1.0 - pbrInputs.perceptualRoughness))).rgb;
  vec3 diffuseLight = SRGBtoLINEAR(textureCube(u_DiffuseEnvSampler, n)).rgb;

#ifdef USE_TEX_LOD
  vec3 specularLight = SRGBtoLINEAR(textureCubeLodEXT(u_SpecularEnvSampler, reflection, lod)).rgb;
#else
  vec3 specularLight = SRGBtoLINEAR(textureCube(u_SpecularEnvSampler, reflection)).rgb;
#endif

  vec3 diffuse = diffuseLight * pbrInputs.diffuseColor;
  vec3 specular = specularLight * (pbrInputs.specularColor * brdf.x + brdf.y);

  // For presentation, this allows us to disable IBL terms
  diffuse *= u_ScaleIBLAmbient.x;
  specular *= u_ScaleIBLAmbient.y;

  return diffuse + specular;
}
#endif

// Basic Lambertian diffuse
// Implementation from Lambert's Photometria https://archive.org/details/lambertsphotome00lambgoog
// See also [1], Equation 1
vec3 diffuse(PBRInfo pbrInputs)
{
  return pbrInputs.diffuseColor / M_PI;
}

// The following equation models the Fresnel reflectance term of the spec equation (aka F())
// Implementation of fresnel from [4], Equation 15
vec3 specularReflection(PBRInfo pbrInputs)
{
  return pbrInputs.reflectance0 +
    (pbrInputs.reflectance90 - pbrInputs.reflectance0) *
    pow(clamp(1.0 - pbrInputs.VdotH, 0.0, 1.0), 5.0);
}

// This calculates the specular geometric attenuation (aka G()),
// where rougher material will reflect less light back to the viewer.
// This implementation is based on [1] Equation 4, and we adopt their modifications to
// alphaRoughness as input as originally proposed in [2].
float geometricOcclusion(PBRInfo pbrInputs)
{
  float NdotL = pbrInputs.NdotL;
  float NdotV = pbrInputs.NdotV;
  float r = pbrInputs.alphaRoughness;

  float attenuationL = 2.0 * NdotL / (NdotL + sqrt(r * r + (1.0 - r * r) * (NdotL * NdotL)));
  float attenuationV = 2.0 * NdotV / (NdotV + sqrt(r * r + (1.0 - r * r) * (NdotV * NdotV)));
  return attenuationL * attenuationV;
}

// The following equation(s) model the distribution of microfacet normals across
// the area being drawn (aka D())
// Implementation from "Average Irregularity Representation of a Roughened Surface
// for Ray Reflection" by T. S. Trowbridge, and K. P. Reitz
// Follows the distribution function recommended in the SIGGRAPH 2013 course notes
// from EPIC Games [1], Equation 3.
float microfacetDistribution(PBRInfo pbrInputs)
{
  float roughnessSq = pbrInputs.alphaRoughness * pbrInputs.alphaRoughness;
  float f = (pbrInputs.NdotH * roughnessSq - pbrInputs.NdotH) * pbrInputs.NdotH + 1.0;
  return roughnessSq / (M_PI * f * f);
}

void PBRInfo_setAmbientLight(inout PBRInfo pbrInputs) {
  pbrInputs.NdotL = 1.0;
  pbrInputs.NdotH = 0.0;
  pbrInputs.LdotH = 0.0;
  pbrInputs.VdotH = 1.0;
}

void PBRInfo_setDirectionalLight(inout PBRInfo pbrInputs, vec3 lightDirection) {
  vec3 n = pbrInputs.n;
  vec3 v = pbrInputs.v;
  vec3 l = normalize(lightDirection);             // Vector from surface point to light
  vec3 h = normalize(l+v);                        // Half vector between both l and v

  pbrInputs.NdotL = clamp(dot(n, l), 0.001, 1.0);
  pbrInputs.NdotH = clamp(dot(n, h), 0.0, 1.0);
  pbrInputs.LdotH = clamp(dot(l, h), 0.0, 1.0);
  pbrInputs.VdotH = clamp(dot(v, h), 0.0, 1.0);
}

void PBRInfo_setPointLight(inout PBRInfo pbrInputs, PointLight pointLight) {
  vec3 light_direction = normalize(pointLight.position - pbr_vPosition);
  PBRInfo_setDirectionalLight(pbrInputs, light_direction);
}

vec3 calculateFinalColor(PBRInfo pbrInputs, vec3 lightColor) {
  // Calculate the shading terms for the microfacet specular shading model
  vec3 F = specularReflection(pbrInputs);
  float G = geometricOcclusion(pbrInputs);
  float D = microfacetDistribution(pbrInputs);

  // Calculation of analytical lighting contribution
  vec3 diffuseContrib = (1.0 - F) * diffuse(pbrInputs);
  vec3 specContrib = F * G * D / (4.0 * pbrInputs.NdotL * pbrInputs.NdotV);
  // Obtain final intensity as reflectance (BRDF) scaled by the energy of the light (cosine law)
  return pbrInputs.NdotL * lightColor * (diffuseContrib + specContrib);
}

vec4 pbr_filterColor(vec4 colorUnused)
{
  // Metallic and Roughness material properties are packed together
  // In glTF, these factors can be specified by fixed scalar values
  // or from a metallic-roughness map
  float perceptualRoughness = u_MetallicRoughnessValues.y;
  float metallic = u_MetallicRoughnessValues.x;
#ifdef HAS_METALROUGHNESSMAP
  // Roughness is stored in the 'g' channel, metallic is stored in the 'b' channel.
  // This layout intentionally reserves the 'r' channel for (optional) occlusion map data
  vec4 mrSample = texture2D(u_MetallicRoughnessSampler, pbr_vUV);
  perceptualRoughness = mrSample.g * perceptualRoughness;
  metallic = mrSample.b * metallic;
#endif
  perceptualRoughness = clamp(perceptualRoughness, c_MinRoughness, 1.0);
  metallic = clamp(metallic, 0.0, 1.0);
  // Roughness is authored as perceptual roughness; as is convention,
  // convert to material roughness by squaring the perceptual roughness [2].
  float alphaRoughness = perceptualRoughness * perceptualRoughness;

  // The albedo may be defined from a base texture or a flat color
#ifdef HAS_BASECOLORMAP
  vec4 baseColor = SRGBtoLINEAR(texture2D(u_BaseColorSampler, pbr_vUV)) * u_BaseColorFactor;
#else
  vec4 baseColor = u_BaseColorFactor;
#endif

#ifdef ALPHA_CUTOFF
  if (baseColor.a < u_AlphaCutoff) {
    discard;
  }
#endif

  vec3 f0 = vec3(0.04);
  vec3 diffuseColor = baseColor.rgb * (vec3(1.0) - f0);
  diffuseColor *= 1.0 - metallic;
  vec3 specularColor = mix(f0, baseColor.rgb, metallic);

  // Compute reflectance.
  float reflectance = max(max(specularColor.r, specularColor.g), specularColor.b);

  // For typical incident reflectance range (between 4% to 100%) set the grazing
  // reflectance to 100% for typical fresnel effect.
  // For very low reflectance range on highly diffuse objects (below 4%),
  // incrementally reduce grazing reflecance to 0%.
  float reflectance90 = clamp(reflectance * 25.0, 0.0, 1.0);
  vec3 specularEnvironmentR0 = specularColor.rgb;
  vec3 specularEnvironmentR90 = vec3(1.0, 1.0, 1.0) * reflectance90;

  vec3 n = getNormal();                          // normal at surface point
  vec3 v = normalize(u_Camera - pbr_vPosition);  // Vector from surface point to camera

  float NdotV = clamp(abs(dot(n, v)), 0.001, 1.0);
  vec3 reflection = -normalize(reflect(v, n));

  PBRInfo pbrInputs = PBRInfo(
    0.0, // NdotL
    NdotV,
    0.0, // NdotH
    0.0, // LdotH
    0.0, // VdotH
    perceptualRoughness,
    metallic,
    specularEnvironmentR0,
    specularEnvironmentR90,
    alphaRoughness,
    diffuseColor,
    specularColor,
    n,
    v
  );

  vec3 color = vec3(0, 0, 0);

#ifdef USE_LIGHTS
  // Apply ambient light
  PBRInfo_setAmbientLight(pbrInputs);
  color += calculateFinalColor(pbrInputs, lighting_uAmbientLight.color);

  // Apply directional light
  SMART_FOR(int i = 0, i < MAX_LIGHTS, i < lighting_uDirectionalLightCount, i++) {
    if (i < lighting_uDirectionalLightCount) {
      PBRInfo_setDirectionalLight(pbrInputs, lighting_uDirectionalLight[i].direction);
      color += calculateFinalColor(pbrInputs, lighting_uDirectionalLight[i].color);
    }
  }

  // Apply point light
  SMART_FOR(int i = 0, i < MAX_LIGHTS, i < lighting_uPointLightCount, i++) {
    if (i < lighting_uPointLightCount) {
      PBRInfo_setPointLight(pbrInputs, lighting_uPointLight[i]);
      float attenuation = getPointLightAttenuation(lighting_uPointLight[i], distance(lighting_uPointLight[i].position, pbr_vPosition));
      color += calculateFinalColor(pbrInputs, lighting_uPointLight[i].color / attenuation);
    }
  }
#endif

  // Calculate lighting contribution from image based lighting source (IBL)
#ifdef USE_IBL
  color += getIBLContribution(pbrInputs, n, reflection);
#endif

  // Apply optional PBR terms for additional (optional) shading
#ifdef HAS_OCCLUSIONMAP
  float ao = texture2D(u_OcclusionSampler, pbr_vUV).r;
  color = mix(color, color * ao, u_OcclusionStrength);
#endif

#ifdef HAS_EMISSIVEMAP
  vec3 emissive = SRGBtoLINEAR(texture2D(u_EmissiveSampler, pbr_vUV)).rgb * u_EmissiveFactor;
  color += emissive;
#endif

  // This section uses mix to override final color for reference app visualization
  // of various parameters in the lighting equation.
#ifdef PBR_DEBUG
  // TODO: Figure out how to debug multiple lights

  // color = mix(color, F, u_ScaleFGDSpec.x);
  // color = mix(color, vec3(G), u_ScaleFGDSpec.y);
  // color = mix(color, vec3(D), u_ScaleFGDSpec.z);
  // color = mix(color, specContrib, u_ScaleFGDSpec.w);

  // color = mix(color, diffuseContrib, u_ScaleDiffBaseMR.x);
  color = mix(color, baseColor.rgb, u_ScaleDiffBaseMR.y);
  color = mix(color, vec3(metallic), u_ScaleDiffBaseMR.z);
  color = mix(color, vec3(perceptualRoughness), u_ScaleDiffBaseMR.w);
#endif

  return vec4(pow(color,vec3(1.0/2.2)), baseColor.a);
}
`;

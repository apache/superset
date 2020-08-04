export default `\
#if (__VERSION__ < 300)
  #define _attribute attribute
  #define _varying varying
#else
  #define _attribute in
#define _varying out
#endif

// Instance attributes
_attribute vec3 instancePositions;
_attribute vec2 instancePositions64xy;
_attribute vec4 instanceColors;
_attribute vec3 instancePickingColors;
_attribute mat3 instanceModelMatrix;
_attribute vec3 instanceTranslation;

// Uniforms
uniform float sizeScale;
uniform mat4 sceneModelMatrix;

// Attributes
_attribute vec4 POSITION;

#ifdef HAS_UV
  _attribute vec2 TEXCOORD_0;
#endif

#ifdef MODULE_PBR
  #ifdef HAS_NORMALS
    _attribute vec4 NORMAL;
  #endif
#endif

// Varying
// MODULE_PBR contains all the varying definitions needed
#ifndef MODULE_PBR
  _varying vec4 vColor;

  #ifdef HAS_UV
    _varying vec2 vTEXCOORD_0;
  #endif
#endif

// Main
void main(void) {
  #if defined(HAS_UV) && !defined(MODULE_PBR)
    vTEXCOORD_0 = TEXCOORD_0;
  #endif

  vec3 pos = (instanceModelMatrix * (sceneModelMatrix * POSITION).xyz) * sizeScale + instanceTranslation;
  pos = project_size(pos);

  vec4 position_commonspace;
  gl_Position = project_position_to_clipspace(instancePositions, instancePositions64xy, pos, position_commonspace);

  #ifdef MODULE_PBR
    // set PBR data
    pbr_vPosition = position_commonspace.xyz;

    #ifdef HAS_NORMALS
      pbr_vNormal = project_normal(instanceModelMatrix * (sceneModelMatrix * vec4(NORMAL.xyz, 0.0)).xyz);
    #endif

    #ifdef HAS_UV
      pbr_vUV = TEXCOORD_0;
    #else
      pbr_vUV = vec2(0., 0.);
    #endif
  #else
    // Flat shading
    vColor = instanceColors / 255.0;
  #endif

  picking_setPickingColor(instancePickingColors);
}
`;

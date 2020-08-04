export default `\
#if (__VERSION__ < 300)
  #define _varying varying
  #define _texture2D texture2D
  #define fragmentColor gl_FragColor
#else
  #define _varying in
  #define _texture2D texture
  out vec4 fragmentColor;
#endif

// Uniforms
// none

// Varying
// MODULE_PBR contains all the varying definitions needed
#ifndef MODULE_PBR
  _varying vec4 vColor;

  #if defined(HAS_UV) && defined(HAS_BASECOLORMAP)
    _varying vec2 vTEXCOORD_0;
    uniform sampler2D u_BaseColorSampler;
  #endif
#endif

void main(void) {
  #ifdef MODULE_PBR
    fragmentColor = pbr_filterColor(vec4(0));
  #else
    #if defined(HAS_UV) && defined(HAS_BASECOLORMAP)
      fragmentColor = vColor * _texture2D(u_BaseColorSampler, vTEXCOORD_0);
    #else
      fragmentColor = vColor;
    #endif
  #endif

  fragmentColor = picking_filterPickingColor(fragmentColor);
}
`;

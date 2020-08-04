export default `\
#define SHADER_NAME luma-modular-fragment

precision highp float;

// varyings
varying vec4 vColor;

void main(){
  gl_FragColor = vec4(1., 0., 1., 1.);

#ifdef MODULE_DIFFUSE
  gl_FragColor = diffuse_filterColor(gl_FragColor);
#endif

#ifdef MODULE_MATERIAL
  gl_FragColor = material_filterColor(gl_FragColor);
#endif

#ifdef MODULE_LIGHTING
  gl_FragColor = lighting_filterColor(gl_FragColor);
#endif

#ifdef MODULE_FOG
  gl_FragColor = fog_filterColor(gl_FragColor);
#endif

#ifdef MODULE_PICKING
  gl_FragColor = picking_filterHighlightColor(gl_FragColor);
  gl_FragColor = picking_filterPickingColor(gl_FragColor);
#endif

#ifdef MODULE_LOGDEPTH
  logdepth_setFragDepth(gl_Position);
#endif
}
`;

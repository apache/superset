export default `\
#define SHADER_NAME luma_modular_vertex

// object attributes
attribute vec3 positions;
attribute vec3 normals;
attribute vec4 colors;
attribute vec2 texCoords;
attribute vec3 pickingColors;

void main(void) {

  // Set up position
#ifdef MODULE_GEOMETRY
  geometry_setPosition(positions);
  geometry_setNormal(normals);
#endif

#ifdef MODULE_PROJECT
  project_setPositionAndNormal_Model(positions, normals);
  gl_Position = project_model_to_clipspace(positions);
#endif

  // Set up depth
#ifdef MODULE_LOGDEPTH
  logdepth_adjustPosition(gl_Position);
#endif

#ifdef MODULE_DIFFUSE
  diffuse_setTextureCoordinate(texCoords);
#endif

  // Set up color calculations
#ifdef MODULE_MATERIAL
  material_setDiffuseColor(colors);
  material_setDiffuseTextureCoordinates(texCoords);
#endif

#ifdef MODULE_LIGHTING
  lighting_setPositionAndNormal(positions, normals);
  lighting_apply_light(positions);
  lighting_apply_reflection(positions);
#endif

#ifdef MODULE_PICKING
  picking_setPickingColor(pickingColors);
#endif

}
`;

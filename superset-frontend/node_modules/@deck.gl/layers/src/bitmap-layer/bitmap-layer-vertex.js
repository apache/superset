export default `
#define SHADER_NAME bitmap-layer-vertex-shader

attribute vec2 texCoords;
attribute vec3 positions;
attribute vec2 positions64xyLow;
attribute vec3 instancePickingColors;

varying vec2 vTexCoord;

void main(void) {
  gl_Position = project_position_to_clipspace(positions, positions64xyLow, vec3(0.0));
 
  vTexCoord = texCoords;
 
  picking_setPickingColor(instancePickingColors);
}
`;

export default `
#define SHADER_NAME simple-mesh-layer-vs

// Scale the model
uniform float sizeScale;

// Primitive attributes
attribute vec3 positions;
attribute vec3 normals;
attribute vec2 texCoords;

// Instance attributes
attribute vec3 instancePositions;
attribute vec2 instancePositions64xy;
attribute vec4 instanceColors;
attribute vec3 instancePickingColors;
attribute mat3 instanceModelMatrix;
attribute vec3 instanceTranslation;

// Outputs to fragment shader
varying vec2 vTexCoord;
varying vec3 cameraPosition;
varying vec3 normals_commonspace;
varying vec4 position_commonspace;
varying vec4 vColor;

void main(void) {
  vec3 pos = (instanceModelMatrix * positions) * sizeScale + instanceTranslation;
  pos = project_size(pos);

  vTexCoord = texCoords;
  cameraPosition = project_uCameraPosition;
  normals_commonspace = project_normal(instanceModelMatrix * normals);
  vColor = instanceColors;

  gl_Position = project_position_to_clipspace(instancePositions, instancePositions64xy, pos, position_commonspace);

  picking_setPickingColor(instancePickingColors);
}
`;

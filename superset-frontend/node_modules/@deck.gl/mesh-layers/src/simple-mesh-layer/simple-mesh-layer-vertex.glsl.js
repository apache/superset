export default `#version 300 es
#define SHADER_NAME simple-mesh-layer-vs

// Scale the model
uniform float sizeScale;

// Primitive attributes
in vec3 positions;
in vec3 normals;
in vec2 texCoords;

// Instance attributes
in vec3 instancePositions;
in vec2 instancePositions64xy;
in vec4 instanceColors;
in vec3 instancePickingColors;
in mat3 instanceModelMatrix;
in vec3 instanceTranslation;

// Outputs to fragment shader
out vec2 vTexCoord;
out vec3 cameraPosition;
out vec3 normals_commonspace;
out vec4 position_commonspace;
out vec4 vColor;

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

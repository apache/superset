// camera and object matrices
uniform mat4 viewMatrix;
uniform mat4 viewInverseMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewProjectionMatrix;

// objectMatrix * viewMatrix = worldMatrix
uniform mat4 worldMatrix;
uniform mat4 worldInverseMatrix;
uniform mat4 worldInverseTransposeMatrix;
uniform mat4 objectMatrix;
uniform vec3 cameraPosition;

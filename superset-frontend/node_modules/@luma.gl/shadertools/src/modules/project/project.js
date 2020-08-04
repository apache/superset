import {Matrix4} from 'math.gl';

const IDENTITY_MATRIX = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

const DEFAULT_MODULE_OPTIONS = {
  modelMatrix: IDENTITY_MATRIX,
  viewMatrix: IDENTITY_MATRIX,
  projectionMatrix: IDENTITY_MATRIX,
  cameraPositionWorld: [0, 0, 0]
};

function getUniforms(opts = DEFAULT_MODULE_OPTIONS, prevUniforms = {}) {
  // const viewProjectionInverse = viewProjection.invert();
  // viewInverseMatrix: view.invert(),
  // viewProjectionInverseMatrix: viewProjectionInverse

  const uniforms = {};
  if (opts.modelMatrix !== undefined) {
    uniforms.modelMatrix = opts.modelMatrix;
  }
  if (opts.viewMatrix !== undefined) {
    uniforms.viewMatrix = opts.viewMatrix;
  }
  if (opts.projectionMatrix !== undefined) {
    uniforms.projectionMatrix = opts.projectionMatrix;
  }
  if (opts.cameraPositionWorld !== undefined) {
    uniforms.cameraPositionWorld = opts.cameraPositionWorld;
  }

  // COMPOSITE UNIFORMS
  if (opts.projectionMatrix !== undefined || opts.viewMatrix !== undefined) {
    uniforms.viewProjectionMatrix = new Matrix4(opts.projectionMatrix).multiplyRight(
      opts.viewMatrix
    );
  }

  return uniforms;
}

const common = `\
varying vec4 project_vPositionWorld;
varying vec3 project_vNormalWorld;

vec4 project_getPosition_World() {
  return project_vPositionWorld;
}

vec3 project_getNormal_World() {
  return project_vNormalWorld;
}
`;

const vs = `\
${common}

// Unprefixed uniforms
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewProjectionMatrix;
uniform vec3 cameraPositionWorld;

struct World {
  vec3 position;
  vec3 normal;
};

World world;

void project_setPosition(vec4 position) {
  project_vPositionWorld = position;
}

void project_setNormal(vec3 normal) {
  project_vNormalWorld = normal;
}

void project_setPositionAndNormal_World(vec3 position, vec3 normal) {
  world.position = position;
  world.normal = normal;
}

void project_setPositionAndNormal_Model(vec3 position, vec3 normal) {
  world.position = (modelMatrix * vec4(position, 1.)).xyz;
  world.normal = mat3(modelMatrix) * normal;
}

vec4 project_model_to_clipspace(vec4 position) {
  return viewProjectionMatrix * modelMatrix * position;
}

vec4 project_model_to_clipspace(vec3 position) {
  return viewProjectionMatrix * modelMatrix * vec4(position, 1.);
}

vec4 project_world_to_clipspace(vec3 position) {
  return viewProjectionMatrix * vec4(position, 1.);
}

vec4 project_view_to_clipspace(vec3 position) {
  return projectionMatrix * vec4(position, 1.);
}

vec4 project_to_clipspace(vec3 position) {
  return viewProjectionMatrix * vec4(position, 1.);
}
`;

const fs = `
${common}\
`;

export default {
  name: 'project',
  getUniforms,
  vs,
  fs
};

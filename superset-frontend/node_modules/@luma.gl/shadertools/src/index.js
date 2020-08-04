// shadertools exports

// DEFAULT SHADERS
// A set of base shaders that leverage the shader module system,
// dynamically enabling features depending on which modules are included
import MODULAR_VS from './shaders/modular-vertex.glsl';
import MODULAR_FS from './shaders/modular-fragment.glsl';

// DOCUMENTED APIS
export {
  registerShaderModules,
  setDefaultShaderModules,
  getDefaultShaderModules
} from './lib/resolve-modules';
export {
  assembleShaders,
  createShaderHook,
  createModuleInjection,
  resetGlobalShaderHooks
} from './lib/assemble-shaders';

// HELPERS
export {combineInjects} from './lib/inject-shader';
export {normalizeShaderModule} from './lib/shader-module';

// UTILS
export {
  getQualifierDetails,
  getPassthroughFS,
  typeToChannelSuffix,
  typeToChannelCount,
  convertToVec4
} from './utils/shader-utils';

// SHADER MODULES
export * from './modules';

export const MODULAR_SHADERS = {
  vs: MODULAR_VS,
  fs: MODULAR_FS,
  uniforms: {}
};

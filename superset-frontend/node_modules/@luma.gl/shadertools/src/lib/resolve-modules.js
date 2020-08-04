import ShaderModuleRegistry from './shader-module-registry';

const shaderModuleRegistry = new ShaderModuleRegistry();

/**
 * Registers an array of default shader modules. These will be concatenated
 * automatically at the end of any shader module list passed to
 * `assembleShaders` (plus `resolveModules` and `getShaderDependencies`)
 * @param {Object[]} modules - Array of shader modules
 */
export function setDefaultShaderModules(modules) {
  shaderModuleRegistry.setDefaultShaderModules(modules);
}

export function getDefaultShaderModules() {
  return shaderModuleRegistry.getDefaultShaderModules();
}

/**
 * Registers an array of shader modules
 * @param {Object[]} shaderModuleList - Array of shader modules
 */
export function registerShaderModules(
  shaderModuleList,
  {ignoreMultipleRegistrations = false} = {}
) {
  shaderModuleRegistry.registerShaderModules(shaderModuleList, {ignoreMultipleRegistrations});
}

// registers any supplied modules and returns a list of module names
export function resolveModules(modules) {
  modules = modules.concat(shaderModuleRegistry.defaultShaderModules);
  modules = shaderModuleRegistry.resolveModules(modules);
  return getShaderDependencies(modules);
}

// Looks up a moduleName among registered modules and returns definition.
// If "inline" module, returns it directly
export function getShaderModule(moduleOrName) {
  return shaderModuleRegistry.getShaderModule(moduleOrName);
}

/**
 * Takes a list of shader module names and returns a new list of
 * shader module names that includes all dependencies, sorted so
 * that modules that are dependencies of other modules come first.
 *
 * If the shader glsl code from the returned modules is concatenated
 * in the reverse order, it is guaranteed that all functions be resolved and
 * that all function and variable definitions come before use.
 *
 * @param {String[]} modules - Array of modules (inline modules or module names)
 * @return {String[]} - Array of modules
 */
function getShaderDependencies(modules) {
  const moduleMap = {};
  const moduleDepth = {};
  getDependencyGraph({modules, level: 0, moduleMap, moduleDepth});

  // Return a reverse sort so that dependencies come before the modules that use them
  return Object.keys(moduleDepth)
    .sort((a, b) => moduleDepth[b] - moduleDepth[a])
    .map(name => moduleMap[name]);
}

/**
 * Recursively checks module dpendencies to calculate dependency
 * level of each module.
 *
 * @param {String[]} modules - Array of modules
 * @param {Number} level - Current level
 * @return {result} - Map of module name to its level
 */
// Adds another level of dependencies to the result map
function getDependencyGraph({modules, level, moduleMap, moduleDepth}) {
  if (level >= 5) {
    throw new Error('Possible loop in shader dependency graph');
  }

  // Update level on all current modules
  for (const module of modules) {
    moduleMap[module.name] = module;
    if (moduleDepth[module.name] === undefined || moduleDepth[module.name] < level) {
      moduleDepth[module.name] = level;
    }
  }

  // Recurse
  for (const module of modules) {
    if (module.dependencies) {
      getDependencyGraph({modules: module.dependencies, level: level + 1, moduleMap, moduleDepth});
    }
  }
}

export const TEST_EXPORTS = {
  getShaderDependencies,
  getDependencyGraph
};

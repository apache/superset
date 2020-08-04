import ShaderModule from './shader-module';
import {assert} from '../utils';

export default class ShaderModuleRegistry {
  constructor() {
    this.shaderModules = {};
    this.defaultShaderModules = [];
  }

  setDefaultShaderModules(modules) {
    this.defaultShaderModules = this.resolveModules(modules);
  }

  getDefaultShaderModules() {
    return this.defaultShaderModules;
  }

  registerShaderModules(shaderModuleList, {ignoreMultipleRegistrations = false} = {}) {
    for (const shaderModule of shaderModuleList) {
      this._registerShaderModule(shaderModule, ignoreMultipleRegistrations);
    }
  }

  getShaderModule(moduleOrName) {
    // Check if "inline" module, return it
    if (moduleOrName instanceof ShaderModule) {
      return moduleOrName;
    }

    // Check if module descriptor
    if (typeof moduleOrName !== 'string') {
      return this._registerShaderModule(moduleOrName, true);
    }

    // Module name - Look up module
    const module = this.shaderModules[moduleOrName];
    if (!module) {
      assert(false, `Unknown shader module ${moduleOrName}`);
    }
    return module;
  }

  // registers any supplied modules, resolves any names into modules
  // returns a list of modules
  resolveModules(modules) {
    return modules.map(moduleOrName => this.getShaderModule(moduleOrName));
  }

  // PRIVATE API

  _registerShaderModule(module, ignoreMultipleRegistrations = false) {
    // Check if "inline" module, return it
    if (module instanceof ShaderModule) {
      return module;
    }

    assert(module.name, 'shader module has no name');

    if (!this.shaderModules[module.name] || ignoreMultipleRegistrations) {
      // if ignoreMultipleRegistrations = true, we allow module to be re-registered
      module = new ShaderModule(module);
      module.dependencies = this.resolveModules(module.dependencies);
      this.shaderModules[module.name] = module;
    } else {
      // TODO - instead verify that definition is not changing...
      throw new Error(`shader module ${module.name} already registered`);
    }

    return this.shaderModules[module.name];
  }
}

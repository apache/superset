class ColorSchemeManager {
  constructor() {
    this.schemes = {};
    this.defaultSchemeName = undefined;
  }

  clearScheme() {
    this.schemes = {};
    return this;
  }

  getScheme(schemeName) {
    return this.schemes[schemeName || this.defaultSchemeName];
  }

  getAllSchemes() {
    return this.schemes;
  }

  getDefaultSchemeName() {
    return this.defaultSchemeName;
  }

  setDefaultSchemeName(schemeName) {
    this.defaultSchemeName = schemeName;
    return this;
  }

  registerScheme(schemeName, colors) {
    this.schemes[schemeName] = colors;
    // If there is no default, set as default
    if (!this.defaultSchemeName) {
      this.defaultSchemeName = schemeName;
    }
    return this;
  }

  registerMultipleSchemes(multipleSchemes) {
    Object.assign(this.schemes, multipleSchemes);
    // If there is no default, set the first scheme as default
    const keys = Object.keys(multipleSchemes);
    if (!this.defaultSchemeName && keys.length > 0) {
      this.defaultSchemeName = keys[0];
    }
    return this;
  }
}

let singleton;

export function getInstance() {
  if (!singleton) {
    singleton = new ColorSchemeManager();
  }
  return singleton;
}

const staticFunctions = Object.getOwnPropertyNames(ColorSchemeManager.prototype)
  .filter(fn => fn !== 'constructor')
  .reduce((all, fn) => {
    const functions = all;
    functions[fn] = function (...args) {
      return getInstance()[fn](...args);
    };
    return functions;
  }, { getInstance });

const {
  clearScheme,
  getScheme,
  getAllSchemes,
  getDefaultSchemeName,
  setDefaultSchemeName,
  registerScheme,
  registerMultipleSchemes,
} = staticFunctions;

export {
  clearScheme,
  getScheme,
  getAllSchemes,
  getDefaultSchemeName,
  setDefaultSchemeName,
  registerScheme,
  registerMultipleSchemes,
};

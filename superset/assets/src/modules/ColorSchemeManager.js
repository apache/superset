import airbnb from './colorSchemes/airbnb';
import categoricalSchemes from './colorSchemes/categorical';
import lyft from './colorSchemes/lyft';

class ColorSchemeManager {
  constructor() {
    this.schemes = {};
    this.defaultSchemeName = undefined;
  }

  get(schemeName) {
    return this.schemes[schemeName || this.defaultSchemeName];
  }

  getAll() {
    return this.schemes;
  }

  getDefaultSchemeName() {
    return this.defaultSchemeName;
  }

  setDefaultSchemeName(schemeName) {
    this.defaultSchemeName = schemeName;
  }

  register(schemeName, colors) {
    this.schemes[schemeName] = colors;
    // If there is no default, set as default
    if (!this.defaultSchemeName) {
      this.defaultSchemeName = schemeName;
    }
  }

  registerAll(multipleSchemes) {
    Object.assign(this.schemes, multipleSchemes);
    // If there is no default, set the first scheme as default
    const keys = Object.keys(multipleSchemes);
    if (!this.defaultSchemeName && keys.length > 0) {
      this.defaultSchemeName = keys[0];
    }
  }
}

let singleton;

function getInstance() {
  if (!singleton) {
    singleton = new ColorSchemeManager();
  }
  return singleton;
}

ColorSchemeManager.getInstance = getInstance;

// These registration code eventually should go into per-app configuration
// when we are completely in the plug-in system.
const manager = ColorSchemeManager.getInstance();
manager.register('bnbColors', airbnb.bnbColors);
manager.registerAll(categoricalSchemes);
manager.register('lyftColors', lyft.lyftColors);
manager.setDefaultSchemeName('bnbColors');

export default ColorSchemeManager;
